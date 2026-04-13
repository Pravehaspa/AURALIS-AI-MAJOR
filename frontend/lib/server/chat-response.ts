import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getAuthSession } from "@/lib/auth"
import { upsertUserPreferences } from "@/lib/server/auth-repository"
import { validateAgentDomain } from "@/lib/server/domain-guard"
import { buildMemoryContext, inferPreferenceUpdate, storeChatMemory } from "@/lib/server/memory-repository"

const GEMINI_TIMEOUT_MS = 25000

const agentConfigSchema = z.object({
  name: z.string().min(1).max(120),
  domain: z.string().min(1).max(200),
  allowedTopics: z.array(z.string().min(1).max(120)).min(1),
  restrictedTopics: z.array(z.string().min(1).max(120)).optional(),
})

const chatMessageSchema = z.object({
  role: z.enum(["user", "model"]),
  parts: z.array(z.string()).min(1),
})

const chatRequestSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000, "Message too long"),
  agentPrompt: z.string().optional(),
  agentCategory: z.string().optional(),
  agentConfig: agentConfigSchema,
  history: z.array(chatMessageSchema).optional(),
})

function buildPrompt(
  message: string,
  agentPrompt?: string,
  agentCategory?: string,
  history?: Array<{ role: "user" | "model"; parts: string[] }>,
  memoryContext?: {
    responseStyle?: string | null
    language?: string | null
    relevantMemory?: Array<{ message: string; response: string }>
  },
) {
  const sections: string[] = []

  sections.push(
    agentPrompt?.trim() ||
      "You are a friendly and talkative AI assistant. Respond conversationally and keep answers concise, helpful, and natural.",
  )

  if (agentCategory?.trim()) {
    sections.push(`Category: ${agentCategory.trim()}`)
  }

  if (memoryContext?.responseStyle || memoryContext?.language) {
    const preferences: string[] = []
    if (memoryContext.responseStyle) {
      preferences.push(`response style: ${memoryContext.responseStyle}`)
    }
    if (memoryContext.language) {
      preferences.push(`language: ${memoryContext.language}`)
    }
    sections.push(`User preferences: ${preferences.join(", ")}`)
  }

  if (memoryContext?.relevantMemory?.length) {
    const memoryText = memoryContext.relevantMemory
      .map((item) => `User said: ${item.message}\nAssistant replied: ${item.response}`)
      .join("\n\n")
    sections.push(`Relevant memory:\n${memoryText}`)
  }

  if (history?.length) {
    const historyText = history
      .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.parts.join(" ")}`)
      .join("\n")
    sections.push(`Conversation so far:\n${historyText}`)
  }

  sections.push(`User: ${message}`)
  sections.push("Assistant:")

  return sections.join("\n\n")
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Upstream timeout after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

export async function handleChatRequest(request: Request) {
  const jsonError = (status: number, error: string, message: string, details?: unknown) =>
    NextResponse.json(
      {
        success: false,
        error,
        message,
        ...(details !== undefined ? { details } : {}),
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )

  try {
    const session = await getAuthSession()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonError(400, "Invalid JSON", "Request body must be valid JSON")
    }

    const payload = chatRequestSchema.safeParse(body)
    if (!payload.success) {
      return jsonError(
        400,
        "Invalid request format",
        "Payload validation failed",
        payload.error.errors.map((item) => `${item.path.join(".")}: ${item.message}`),
      )
    }

    const { message, agentPrompt, agentCategory, agentConfig, history } = payload.data
    const domainValidation = validateAgentDomain(message, agentCategory, agentPrompt, agentConfig)
    const userId = session?.user?.id || null
    const memoryContext = userId ? await buildMemoryContext(userId, message) : null
    const inferredPreferences = userId ? inferPreferenceUpdate(message) : {}

    if (domainValidation.enforced && !domainValidation.allowed) {
      return NextResponse.json({ success: true, text: domainValidation.rejectionText, model: "domain-guard" })
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return jsonError(500, "Missing Environment Variable", "Server is missing GOOGLE_AI_API_KEY")
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash"
    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel({ model: modelName })
    const prompt = buildPrompt(message, agentPrompt, agentCategory, history, memoryContext || undefined)
    const result = await withTimeout(model.generateContent(prompt), GEMINI_TIMEOUT_MS)
    const text = result.response.text().trim()

    if (!text) {
      if (memoryContext?.cachedResponse) {
        return NextResponse.json(
          { success: true, text: memoryContext.cachedResponse, model: "memory-fallback" },
          { headers: { "Cache-Control": "no-store" } },
        )
      }

      return jsonError(502, "Upstream Model Error", "Model returned an empty response")
    }

    if (userId) {
      if (inferredPreferences.responseStyle || inferredPreferences.language) {
        await upsertUserPreferences({
          userId,
          responseStyle: inferredPreferences.responseStyle || memoryContext?.preferences?.response_style || undefined,
          language: inferredPreferences.language || memoryContext?.preferences?.language || undefined,
        })
      }

      await storeChatMemory({
        userId,
        message,
        response: text,
        isImportant: true,
      })
    }

    return NextResponse.json(
      { success: true, text, model: modelName, memoryEnabled: Boolean(userId) },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch (error) {
    console.error("Chat API failed:", error)
    const session = await getAuthSession().catch(() => null)
    const userId = session?.user?.id || null
    if (userId) {
      const cachedResponse = await buildMemoryContext(userId, "").then((context) => context.cachedResponse).catch(() => null)
      if (cachedResponse) {
        return NextResponse.json(
          { success: true, text: cachedResponse, model: "memory-fallback" },
          { headers: { "Cache-Control": "no-store" } },
        )
      }
    }

    if (error instanceof Error && error.message.includes("Upstream timeout")) {
      return jsonError(504, "Upstream Timeout", "The AI provider timed out. Please retry.")
    }
    return jsonError(
      500,
      "Internal Server Error",
      "Failed to generate response",
      error instanceof Error ? error.message : "Unknown error",
    )
  }
}