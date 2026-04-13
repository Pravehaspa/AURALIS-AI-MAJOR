import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getAuthSession } from "@/lib/auth"
import { upsertUserPreferences } from "@/lib/server/auth-repository"
import { validateAgentDomain } from "@/lib/server/domain-guard"
import { buildMemoryContext, inferPreferenceUpdate, storeChatMemory } from "@/lib/server/memory-repository"

const GEMINI_TIMEOUT_MS = 25000
const FALLBACK_MODELS = ["gemini-2.0-flash"]

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

  sections.push(
    "Answer the user's question directly. If a diagram, flowchart, or visual structure would help, include a Mermaid code block after the explanation. If the user explicitly asks for only a diagram, output only Mermaid syntax in a fenced mermaid block.",
  )
  sections.push("Provide a concrete answer first. Ask at most one concise follow-up question only when needed.")

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

function isRetryableGeminiError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes("503") ||
    message.includes("service unavailable") ||
    message.includes("high demand") ||
    message.includes("429") ||
    message.includes("too many requests")
  )
}

async function generateWithModelFallback(apiKey: string, modelNames: string[], prompt: string) {
  let lastError: unknown = null

  for (const modelName of modelNames) {
    try {
      const ai = new GoogleGenerativeAI(apiKey)
      const model = ai.getGenerativeModel({ model: modelName })
      const result = await withTimeout(model.generateContent(prompt), GEMINI_TIMEOUT_MS)
      const text = result.response.text().trim()

      if (text) {
        return { text, modelName }
      }

      lastError = new Error(`Model ${modelName} returned an empty response`)
    } catch (error) {
      lastError = error
      if (!isRetryableGeminiError(error)) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to generate response")
}

function buildGracefulFallback(message: string, agentCategory?: string) {
  const normalized = message.toLowerCase().trim()

  if (/^(hi|hello|hey|good morning|good evening)\b/.test(normalized)) {
    return "Hi! I am your Creative Artist assistant. Share your idea, and I will help with concept, style, colors, composition, and a diagram if needed."
  }

  if (normalized.includes("creative soul")) {
    return "A creative soul is someone who naturally expresses ideas through imagination, emotion, and original thinking. In design terms, it means exploring unique concepts, visual storytelling, and personal style instead of copying trends."
  }

  const categoryText = agentCategory?.trim() || "this topic"
  return [
    `I’m having trouble reaching the AI service right now, but I can still help with ${categoryText}.`,
    `Please ask your request in this format so I can answer clearly:`,
    `1. Goal`,
    `2. Style or mood`,
    `3. Output type (text, diagram, or both)`,
    `Send it again and I will respond with a clean creative answer.`,
  ].join("\n")
}

function requestNeedsDiagram(message: string) {
  const normalized = message.toLowerCase()
  const diagramKeywords = [
    "diagram",
    "flowchart",
    "flow chart",
    "mindmap",
    "mind map",
    "workflow",
    "architecture",
    "visual",
  ]

  return diagramKeywords.some((keyword) => normalized.includes(keyword))
}

function hasMermaidBlock(text: string) {
  return /```mermaid\s*[\s\S]*?```/i.test(text)
}

function buildFallbackMermaid(message: string) {
  const topic =
    message
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join(" ") || "Creative Topic"

  return [
    "```mermaid",
    "flowchart TD",
    `A[${topic}] --> B[Inspiration and Research]`,
    "B --> C[Concept Exploration]",
    "C --> D[Design Development]",
    "D --> E[Review and Final Output]",
    "```",
  ].join("\n")
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

    const prompt = buildPrompt(message, agentPrompt, agentCategory, history, memoryContext || undefined)
    const primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash"
    const modelAttempts = [primaryModel, ...FALLBACK_MODELS.filter((model) => model !== primaryModel)]
    let text = ""
    let modelName = primaryModel

    try {
      const result = await generateWithModelFallback(apiKey, modelAttempts, prompt)
      text = result.text
      modelName = result.modelName
    } catch (generationError) {
      console.error("Gemini generation failed, using graceful fallback:", generationError)
      text = buildGracefulFallback(message, agentCategory)
      modelName = "fallback-response"
    }

    if (!text) {
      if (memoryContext?.cachedResponse) {
        return NextResponse.json(
          { success: true, text: memoryContext.cachedResponse, model: "memory-fallback" },
          { headers: { "Cache-Control": "no-store" } },
        )
      }

      return jsonError(502, "Upstream Model Error", "Model returned an empty response")
    }

    if (requestNeedsDiagram(message) && !hasMermaidBlock(text)) {
      text = `${text}\n\n${buildFallbackMermaid(message)}`
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