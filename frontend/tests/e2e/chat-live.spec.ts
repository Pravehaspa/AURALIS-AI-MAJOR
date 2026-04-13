import { expect, test } from "@playwright/test"

const runLive = process.env.E2E_LIVE === "1"

test.describe("Live API smoke", () => {
  test.skip(!runLive, "Set E2E_LIVE=1 to run live (non-mocked) chat smoke tests.")

  test("main chat returns a live response", async ({ page }) => {
    await page.goto("/chat/1")

    const messageBubbles = page.locator('div[class*="rounded-lg p-3"] p.text-sm')
    await expect(messageBubbles.first()).toBeVisible()

    const beforeCount = await messageBubbles.count()

    const input = page.locator("textarea")
    await input.fill("Give me one short breathing tip.")
    await input.press("Enter")

    await expect(messageBubbles).toHaveCount(beforeCount + 2, { timeout: 60_000 })

    const latestText = (await messageBubbles.nth(beforeCount + 1).innerText()).trim()
    expect(latestText.length).toBeGreaterThan(0)
    expect(latestText.toLowerCase()).not.toContain("failed to generate response")
  })

  test("widget chat returns a live response", async ({ page }) => {
    await page.goto("/chat-widget/1")

    const messageBubbles = page.locator('div[class*="rounded-lg p-3"] p.text-sm')
    await expect(messageBubbles.first()).toBeVisible()

    const beforeCount = await messageBubbles.count()

    const input = page.locator("textarea")
    await input.fill("Share one brief anti-stress suggestion.")
    await input.press("Enter")

    await expect(messageBubbles).toHaveCount(beforeCount + 2, { timeout: 60_000 })

    const latestText = (await messageBubbles.nth(beforeCount + 1).innerText()).trim()
    expect(latestText.length).toBeGreaterThan(0)
    expect(latestText.toLowerCase()).not.toContain("failed to generate response")
  })
})
