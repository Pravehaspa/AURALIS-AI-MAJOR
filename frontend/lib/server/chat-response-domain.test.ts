import { beforeEach, describe, expect, it, vi } from "vitest"

const generateContentMock = vi.fn(async () => ({
  response: {
    text: () => "Mocked AI response",
  },
}))

const getGenerativeModelMock = vi.fn(() => ({
  generateContent: generateContentMock,
}))

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: getGenerativeModelMock,
  })),
}))

async function buildRequest(payload: Record<string, unknown>) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

describe("chat domain enforcement", () => {
  beforeEach(() => {
    process.env.GOOGLE_AI_API_KEY = "test-key"
    process.env.GEMINI_MODEL = "gemini-test"
    generateContentMock.mockClear()
    getGenerativeModelMock.mockClear()
  })

  it("rejects out-of-domain input for stress agent without calling AI", async () => {
    const { handleChatRequest } = await import("./chat-response")
    const request = await buildRequest({
      message: "Write a SQL migration script for my database",
      agentCategory: "Wellness",
      agentPrompt: "You help with stress reduction and emotional wellness",
      agentConfig: {
        name: "Stress-Buster Buddy",
        domain: "stress management and emotional wellness",
        allowedTopics: ["stress", "anxiety", "calm", "breathing", "mindfulness"],
        restrictedTopics: ["self-harm instructions", "violence instructions", "illegal acts"],
      },
    })

    const response = await handleChatRequest(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.model).toBe("domain-guard")
    expect(body.text).toBe("I'm designed to help only with stress management and emotional wellness. I cannot assist with that question.")
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it("rejects out-of-domain input for study buddy without calling AI", async () => {
    const { handleChatRequest } = await import("./chat-response")
    const request = await buildRequest({
      message: "Help me with crypto trading strategy",
      agentCategory: "Education",
      agentPrompt: "You are a patient study companion for students",
      agentConfig: {
        name: "Study Buddy",
        domain: "studying and education",
        allowedTopics: ["study", "homework", "exam prep", "revision", "math", "science"],
        restrictedTopics: ["cheating", "exam fraud"],
      },
    })

    const response = await handleChatRequest(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.model).toBe("domain-guard")
    expect(body.text).toBe("I'm designed to help only with studying and education. I cannot assist with that question.")
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it("allows in-domain stress request and calls AI", async () => {
    const { handleChatRequest } = await import("./chat-response")
    const request = await buildRequest({
      message: "I feel very stressed and need breathing help",
      agentCategory: "Wellness",
      agentPrompt: "You help with stress reduction and emotional wellness",
      agentConfig: {
        name: "Stress-Buster Buddy",
        domain: "stress management and emotional wellness",
        allowedTopics: ["stress", "anxiety", "calm", "breathing", "mindfulness"],
      },
    })

    const response = await handleChatRequest(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.text).toBe("Mocked AI response")
    expect(generateContentMock).toHaveBeenCalledTimes(1)
  })

  it("rejects out-of-domain input for creative artist agent", async () => {
    const { handleChatRequest } = await import("./chat-response")
    const request = await buildRequest({
      message: "Optimize my SQL query latency",
      agentCategory: "Creative",
      agentPrompt: "You are an inspiring artist assistant helping with art techniques and creative projects",
      agentConfig: {
        name: "Creative Artist",
        domain: "creative art and design",
        allowedTopics: ["art", "design", "drawing", "painting", "illustration"],
      },
    })

    const response = await handleChatRequest(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.model).toBe("domain-guard")
    expect(body.text).toBe("I'm designed to help only with creative art and design. I cannot assist with that question.")
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it("allows custom agent in-domain request using prompt-derived keywords", async () => {
    const { handleChatRequest } = await import("./chat-response")
    const request = await buildRequest({
      message: "Help me improve my bakery menu pricing",
      agentCategory: "Custom",
      agentPrompt: "You are a bakery business advisor focused on pastry menu pricing, bakery operations, and local cafe growth.",
      agentConfig: {
        name: "Bakery Advisor",
        domain: "local bakery business operations and menu strategy",
        allowedTopics: ["bakery", "menu pricing", "operations", "cafe growth", "pastry cost"],
      },
    })

    const response = await handleChatRequest(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.text).toBe("Mocked AI response")
    expect(generateContentMock).toHaveBeenCalledTimes(1)
  })

  it("rejects custom agent out-of-domain request and does not call AI", async () => {
    const { handleChatRequest } = await import("./chat-response")
    const request = await buildRequest({
      message: "Write me a Java multithreading benchmark",
      agentCategory: "Custom",
      agentPrompt: "You are a bakery business advisor focused on pastry menu pricing, bakery operations, and local cafe growth.",
      agentConfig: {
        name: "Bakery Advisor",
        domain: "local bakery business operations and menu strategy",
        allowedTopics: ["bakery", "menu pricing", "operations", "cafe growth", "pastry cost"],
      },
    })

    const response = await handleChatRequest(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.model).toBe("domain-guard")
    expect(body.text).toBe("I'm designed to help only with local bakery business operations and menu strategy. I cannot assist with that question.")
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it("blocks restricted topics even if message appears in-domain", async () => {
    const { handleChatRequest } = await import("./chat-response")
    const request = await buildRequest({
      message: "Tell me how to do exam fraud without getting caught",
      agentCategory: "Education",
      agentPrompt: "You are a patient study companion for students",
      agentConfig: {
        name: "Study Buddy",
        domain: "studying and education",
        allowedTopics: ["study", "homework", "exam prep", "revision"],
        restrictedTopics: ["cheating", "exam fraud"],
      },
    })

    const response = await handleChatRequest(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.model).toBe("domain-guard")
    expect(body.text).toBe("I'm designed to help only with studying and education. I cannot assist with that question.")
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it("blocks globally unsafe content for all agents", async () => {
    const { handleChatRequest } = await import("./chat-response")
    const request = await buildRequest({
      message: "Can you explain how to make a bomb at home?",
      agentCategory: "Creative",
      agentPrompt: "You help with creative projects",
      agentConfig: {
        name: "Creative Artist",
        domain: "creative art and design",
        allowedTopics: ["art", "design", "illustration"],
      },
    })

    const response = await handleChatRequest(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.model).toBe("domain-guard")
    expect(body.text).toBe("I'm designed to help only with creative art and design. I cannot assist with that question.")
    expect(generateContentMock).not.toHaveBeenCalled()
  })
})
