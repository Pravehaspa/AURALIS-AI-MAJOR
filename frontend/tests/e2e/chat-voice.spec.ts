import { expect, test } from "@playwright/test"

function installBrowserMocks() {
  return () => {
    const mockStream = {
      getTracks: () => [{ stop: () => undefined }],
    }

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {},
        configurable: true,
      })
    }

    ;(navigator.mediaDevices as any).getUserMedia = async () => mockStream

    class MockSpeechRecognition {
      public continuous = true
      public interimResults = true
      public lang = "en-US"
      public onstart: null | (() => void) = null
      public onresult: null | ((event: any) => void) = null
      public onerror: null | ((event: any) => void) = null
      public onend: null | (() => void) = null

      start() {
        this.onstart?.()
      }

      stop() {
        this.onend?.()
      }
    }

    ;(window as any).__mockSpeechInstances = [] as any[]
    const OriginalMock = MockSpeechRecognition
    ;(window as any).SpeechRecognition = class extends OriginalMock {
      constructor() {
        super()
        ;(window as any).__mockSpeechInstances.push(this)
      }
    }
    ;(window as any).webkitSpeechRecognition = (window as any).SpeechRecognition

    ;(window as any).__emitMockSpeechFinal = (text: string) => {
      const instances = (window as any).__mockSpeechInstances as any[]
      const active = instances[instances.length - 1]
      if (!active?.onresult) {
        return
      }

      active.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: text }, isFinal: true }],
      })
    }

    ;(window as any).__emitMockSpeechInterim = (text: string) => {
      const instances = (window as any).__mockSpeechInstances as any[]
      const active = instances[instances.length - 1]
      if (!active?.onresult) {
        return
      }

      active.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: text }, isFinal: false }],
      })
    }

    const nativePause = HTMLMediaElement.prototype.pause
    ;(window as any).__audioPlayCount = 0
    ;(window as any).__audioPauseCount = 0
    HTMLMediaElement.prototype.play = function playMock() {
      try {
        Object.defineProperty(this, "duration", { value: 10, configurable: true })
      } catch {
        // Ignore if environment keeps duration non-configurable.
      }
      this.currentTime = 1
      ;(window as any).__audioPlayCount += 1
      this.dispatchEvent(new Event("play"))
      return Promise.resolve()
    }

    HTMLMediaElement.prototype.pause = function pauseMock() {
      nativePause.call(this)
      ;(window as any).__audioPauseCount += 1
      this.dispatchEvent(new Event("pause"))
    }
  }
}

async function installApiMocks(page: import("@playwright/test").Page) {
  await page.route("**/api/chat", async (route) => {
    const req = route.request()
    const body = req.postDataJSON() as { message?: string }
    const message = (body?.message || "").toLowerCase()

    let text = `Answer: ${body?.message || ""}`
    if (message.includes("calm") || message.includes("stress")) {
      text = "Take a slow breath in for 4 counts, hold for 4, and exhale for 6. Repeat 5 times."
    }
    if (message.includes("2+5") || message.includes("2 + 5")) {
      text = "2 + 5 = 7."
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text, model: "mock" }),
    })
  })

  await page.route("**/api/text-to-speech", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ audioUrl: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA" }),
    })
  })
}

test.describe("Main chat reliability and voice controls", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installBrowserMocks())
    await installApiMocks(page)
  })

  test("first message responds on first attempt and repeated query also responds", async ({ page }) => {
    await page.goto("/chat/1")

    const input = page.locator("textarea")
    await input.fill("How to calm down?")
    await input.press("Enter")

    await expect(page.getByText("Take a slow breath in for 4 counts")).toBeVisible()

    await page.waitForTimeout(900)
    await input.fill("How to calm down?")
    await input.press("Enter")

    await expect(page.getByText("Take a slow breath in for 4 counts")).toHaveCount(2)
  })

  test("Voice Auto Send defaults to ON and persists across refresh", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("voice_auto_send_enabled")
    })

    await page.goto("/chat/1")
    await expect(page.getByRole("button", { name: /Voice Auto Send: ON/i })).toBeVisible()

    await page.reload()
    await expect(page.getByRole("button", { name: /Voice Auto Send: ON/i })).toBeVisible()
  })

  test("auto mode on/off and play pause stop controls", async ({ page }) => {
    await page.goto("/chat/1")

    const input = page.locator("textarea")
    await input.fill("How to calm down?")
    await input.press("Enter")

    // Auto mode defaults ON; pause should appear from auto-play.
    await expect(page.getByRole("button", { name: /Pause/i }).first()).toBeVisible()

    await page.getByRole("button", { name: /Pause/i }).first().click()
    await expect(page.getByRole("button", { name: /Play|Resume/i }).first()).toBeVisible()

    await page.getByRole("button", { name: /Stop/i }).first().click()
    await expect(page.getByRole("button", { name: /Play/i }).first()).toBeVisible()

    await page.getByRole("button", { name: /Auto Mode: ON/i }).click()
    await expect(page.getByRole("button", { name: /Auto Mode: OFF/i })).toBeVisible()

    await input.fill("What is 2+5")
    await input.press("Enter")

    // Auto OFF -> should stay in Play state (manual trigger required).
    await expect(page.getByRole("button", { name: /Play/i }).last()).toBeVisible()
  })

  test("listening activation is stable", async ({ page }) => {
    await page.goto("/chat/1")

    await page.getByRole("button", { name: /Auto Mode: ON/i }).click()
    await expect(page.getByRole("button", { name: /Auto Mode: OFF/i })).toBeVisible()

    const startListening = page.getByRole("button", { name: /Voice Input/i })
    await startListening.click()
    await page.waitForTimeout(800)

    const stopListening = page.getByRole("button", { name: /Stop Listening/i })
    if (await stopListening.isVisible({ timeout: 3000 }).catch(() => false)) {
      await stopListening.click()
    }

    await expect(page.getByRole("button", { name: /Voice Input|Stop Listening/i })).toBeVisible()
  })

  test("Voice Auto Send OFF does not submit on stop", async ({ page }) => {
    await page.goto("/chat/1")

    let generateCalls = 0
    page.on("request", (request) => {
      if (request.url().includes("/api/chat")) {
        generateCalls += 1
      }
    })

    await page.getByRole("button", { name: /Voice Auto Send: ON/i }).click()
    await expect(page.getByRole("button", { name: /Voice Auto Send: OFF/i })).toBeVisible()

    await page.getByRole("button", { name: /Voice Input/i }).click()
    await page.evaluate(() => {
      ;(window as any).__emitMockSpeechInterim("This should stay in input only")
    })

    await page.getByRole("button", { name: /Stop Listening/i }).click()
    await expect(page.locator("textarea")).toHaveValue(/This should stay in input only/i)
    await expect(page.getByText(/Sending in [1-5]/i)).toHaveCount(0)

    await page.waitForTimeout(1200)
    expect(generateCalls).toBe(0)
  })

  test("Voice Auto Send OFF never submits after silence finalize", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("voice_auto_send_enabled", "0")
    })
    await page.goto("/chat/1")

    let generateCalls = 0
    page.on("request", (request) => {
      if (request.url().includes("/api/chat")) {
        generateCalls += 1
      }
    })

    await expect(page.getByRole("button", { name: /Voice Auto Send: OFF/i })).toBeVisible()

    await page.getByRole("button", { name: /Voice Input/i }).click()
    await page.evaluate(() => {
      ;(window as any).__emitMockSpeechFinal("Silence finalize should not submit")
    })

    await expect(page.locator("textarea")).toHaveValue(/Silence finalize should not submit/i)
    await expect(page.getByText(/Sending in [1-5]/i)).toHaveCount(0)
    await page.waitForTimeout(6500)

    expect(generateCalls).toBe(0)
  })

  test("append behavior: resume before final timer appends transcript", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("voice_auto_send_enabled", "0")
    })
    await page.goto("/chat/1")

    await expect(page.getByRole("button", { name: /Voice Auto Send: OFF/i })).toBeVisible()

    await page.getByRole("button", { name: /Voice Input/i }).click()
    await expect(page.getByRole("button", { name: /Stop Listening/i })).toBeVisible()

    await page.evaluate(() => {
      ;(window as any).__emitMockSpeechFinal("Hello I am")
    })

    await page.waitForTimeout(3000)

    await page.evaluate(() => {
      ;(window as any).__emitMockSpeechFinal("learning AI")
    })

    await page.waitForTimeout(7600)

    await expect(page.getByRole("button", { name: /Voice Input/i })).toBeVisible()
    await expect(page.locator("textarea")).toHaveValue(/Hello I am learning AI/i)
  })

  test("append behavior: interim phrase is preserved and appended after pause-resume", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("voice_auto_send_enabled", "0")
    })
    await page.goto("/chat/1")

    await expect(page.getByRole("button", { name: /Voice Auto Send: OFF/i })).toBeVisible()

    await page.getByRole("button", { name: /Voice Input/i }).click()
    await expect(page.getByRole("button", { name: /Stop Listening/i })).toBeVisible()

    await page.evaluate(() => {
      ;(window as any).__emitMockSpeechInterim("Hello I am")
    })

    await page.waitForTimeout(3000)

    await page.evaluate(() => {
      ;(window as any).__emitMockSpeechFinal("learning AI")
    })

    await page.waitForTimeout(7600)

    await expect(page.getByRole("button", { name: /Voice Input/i })).toBeVisible()
    await expect(page.locator("textarea")).toHaveValue(/Hello I am learning AI/i)
  })

  test("timeout behavior: resume after full silence window starts new input", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("voice_auto_send_enabled", "0")
    })
    await page.goto("/chat/1")

    await expect(page.getByRole("button", { name: /Voice Auto Send: OFF/i })).toBeVisible()

    await page.getByRole("button", { name: /Voice Input/i }).click()
    await page.evaluate(() => {
      ;(window as any).__emitMockSpeechFinal("Hello")
    })

    await page.waitForTimeout(7600)
    await expect(page.locator("textarea")).toHaveValue(/^Hello$/)

    await page.getByRole("button", { name: /Voice Input/i }).click()
    await page.evaluate(() => {
      ;(window as any).__emitMockSpeechFinal("learning AI")
    })

    await page.waitForTimeout(7600)
    await expect(page.locator("textarea")).toHaveValue(/^learning AI$/i)
  })

  test("TTS playback never triggers new user message until voice input is clicked again", async ({ page }) => {
    await page.goto("/chat/1")

    const autoSendOff = page.getByRole("button", { name: /Voice Auto Send: OFF/i })
    if (await autoSendOff.isVisible().catch(() => false)) {
      await autoSendOff.click()
      await expect(page.getByRole("button", { name: /Voice Auto Send: ON/i })).toBeVisible()
    }

    let generateCalls = 0
    page.on("request", (request) => {
      if (request.url().includes("/api/chat")) {
        generateCalls += 1
      }
    })

    const input = page.locator("textarea")
    await input.fill("How to calm down?")
    await input.press("Enter")

    await expect(page.getByText("Take a slow breath in for 4 counts")).toBeVisible()
    expect(generateCalls).toBe(1)

    await page.waitForTimeout(1800)
    expect(generateCalls).toBe(1)

    await page.getByRole("button", { name: /Pause/i }).first().click()
    await expect(page.getByRole("button", { name: /Voice Input/i })).toBeEnabled()

    await page.getByRole("button", { name: /Voice Input/i }).click()
    await expect(page.getByRole("button", { name: /Stop Listening/i })).toBeVisible()
    await page.evaluate(() => {
      ;(window as any).__emitMockSpeechFinal("Manual click required")
    })

    await expect(page.getByText(/Sending in [1-5]/i)).toHaveCount(0)

    await expect.poll(() => generateCalls, { timeout: 15000 }).toBe(2)
  })

  test("new user message immediately interrupts current TTS (barge-in)", async ({ page }) => {
    await page.goto("/chat/1")

    const input = page.locator("textarea")
    await input.fill("How to calm down?")
    await input.press("Enter")

    await expect(page.getByText("Take a slow breath in for 4 counts")).toBeVisible()
    await expect(page.getByRole("button", { name: /Pause/i }).first()).toBeVisible()

    const pausesBefore = await page.evaluate(() => (window as any).__audioPauseCount || 0)

    await input.fill("What is 2+5")
    await input.press("Enter")

    await expect
      .poll(async () => page.evaluate(() => (window as any).__audioPauseCount || 0), { timeout: 4000 })
      .toBeGreaterThan(pausesBefore)

    await expect(page.getByText("2 + 5 = 7.")).toBeVisible()
    await expect(page.getByRole("button", { name: /Pause/i })).toHaveCount(1)
  })

  test("voice input auto-exits after 7 seconds when no speech is detected", async ({ page }) => {
    await page.goto("/chat/1")

    let generateCalls = 0
    page.on("request", (request) => {
      if (request.url().includes("/api/chat")) {
        generateCalls += 1
      }
    })

    await page.getByRole("button", { name: /Voice Input/i }).click()
    await expect(page.getByRole("button", { name: /Stop Listening/i })).toBeVisible()

    await page.waitForTimeout(7600)

    await expect(page.getByRole("button", { name: /Voice Input/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /Stop Listening/i })).toHaveCount(0)
    expect(generateCalls).toBe(0)
  })
})

test.describe("Main and widget parity", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installBrowserMocks())
    await installApiMocks(page)
  })

  test("widget chat has same auto mode and voice controls", async ({ page }) => {
    await page.goto("/chat-widget/1")

    await expect(page.getByRole("button", { name: /Auto Mode: ON/i })).toBeVisible()

    const input = page.locator("textarea")
    await input.fill("How to calm down?")
    await input.press("Enter")

    await expect(page.getByRole("button", { name: /Pause/i }).first()).toBeVisible()
    await page.getByRole("button", { name: /Pause/i }).first().click()
    await expect(page.getByRole("button", { name: /Play|Resume/i }).first()).toBeVisible()
  })

  test("widget voice input auto-exits after 7 seconds with no speech", async ({ page }) => {
    await page.goto("/chat-widget/1")

    let generateCalls = 0
    page.on("request", (request) => {
      if (request.url().includes("/api/chat")) {
        generateCalls += 1
      }
    })

    await page.getByRole("button", { name: /Voice Input/i }).click()
    await expect(page.getByRole("button", { name: /Stop Listening/i })).toBeVisible()
    await expect(page.getByText(/Sending in [1-5]/i)).toHaveCount(0)

    await page.waitForTimeout(7600)

    await expect(page.getByRole("button", { name: /Voice Input/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /Stop Listening/i })).toHaveCount(0)
    expect(generateCalls).toBe(0)
  })
})
