import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getAuthSession } from "@/lib/auth"
import { getRedisClient } from "@/lib/redis"
import { upsertUserPreferences } from "@/lib/server/auth-repository"
import { validateAgentDomain } from "@/lib/server/domain-guard"
import { buildMemoryContext, extractPersonalSignalsFromMessage, inferPreferenceUpdate, storeChatMemory } from "@/lib/server/memory-repository"

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
  botId: z.string().max(120).optional(),
  agentConfig: agentConfigSchema,
  history: z.array(chatMessageSchema).optional(),
})

const PREDEFINED_RESPONSES: Array<{ match: RegExp; response: string }> = [
  {
    match: /^(hi|hello|hey|good morning|good evening)\b/i,
    response: "Hi. I am ready to help. Tell me your goal, and I will give you a focused plan right away.",
  },
  {
    match: /^(who are you|what can you do)\??$/i,
    response:
      "I am your configured AI assistant. I can answer questions, guide decisions, and adapt to your preferred response style and conversation history.",
  },
]

function normalizeForCache(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ")
}

function buildCacheKey(input: {
  userId: string
  botId?: string
  message: string
  agentCategory?: string
  responseStyle?: string | null
  language?: string | null
}) {
  const keyParts = [
    "chat",
    input.userId,
    input.botId || "default",
    normalizeForCache(input.message),
    normalizeForCache(input.agentCategory || ""),
    normalizeForCache(input.responseStyle || ""),
    normalizeForCache(input.language || ""),
  ]

  return keyParts.join(":")
}

function matchPredefinedResponse(message: string) {
  for (const entry of PREDEFINED_RESPONSES) {
    if (entry.match.test(message.trim())) {
      return entry.response
    }
  }
  return null
}

function resolveGeminiApiKey(botId?: string) {
  if (botId === "2") {
    return process.env.GOOGLE_AI_API_KEY_CHAT_2 || process.env.GOOGLE_AI_API_KEY
  }

  return process.env.GOOGLE_AI_API_KEY
}

function isSampleQuestionRequest(message: string) {
  return /(sample questions?|example questions?|questions? to ask you|what can i ask you)/i.test(message)
}

function getSampleQuestions(input: { category?: string; allowedTopics?: string[]; assistantName?: string }) {
  const category = (input.category || "").toLowerCase()
  const allowed = (input.allowedTopics || []).map((item) => item.trim()).filter(Boolean)
  const first = allowed.slice(0, 3)

  const byCategory: Record<string, string[]> = {
    wellness: [
      "How can I calm down in 5 minutes?",
      "Give me a simple bedtime routine for less stress.",
      "What should I do when I feel overwhelmed at work?",
      "Can you guide me through a short breathing exercise?",
      "Help me build a low-stress weekly plan.",
      "What are healthy ways to manage anxiety spikes?",
    ],
    creative: [
      "Give me 5 concept ideas for my project.",
      "How can I improve composition in this design?",
      "Suggest a color palette for a calm brand.",
      "Help me write a creative brief.",
      "What art exercises can improve my style?",
      "Can you turn my rough idea into a clear concept?",
    ],
    health: [
      "Build me a beginner workout plan for 4 days.",
      "What should I eat after training?",
      "Give me a 20-minute home workout.",
      "How can I improve recovery and sleep?",
      "Help me set realistic fitness goals.",
      "What habits improve consistency in exercise?",
    ],
    education: [
      "Explain this topic in simple words.",
      "Quiz me with 5 questions.",
      "Help me make a 7-day revision plan.",
      "How do I remember concepts faster?",
      "Can you break this chapter into easy steps?",
      "Teach me with examples and then test me.",
    ],
  }

  if (byCategory[category]) {
    return byCategory[category].slice(0, 6)
  }

  if (first.length > 0) {
    return [
      `Can you help me with ${first[0]}?`,
      first[1] ? `Give me beginner guidance for ${first[1]}.` : "Give me a beginner-friendly step-by-step plan.",
      first[2] ? `What common mistakes should I avoid in ${first[2]}?` : "What common mistakes should I avoid?",
      "Can you summarize this in simple terms?",
      "Can you give me a short action plan for today?",
      "Can you ask me 3 clarifying questions before advising me?",
    ].slice(0, 6)
  }

  return [
    "What can you help me with right now?",
    "Can you give me a simple step-by-step plan?",
    "Can you explain this topic in plain language?",
    "What should I do first if I am stuck?",
    "Can you provide a concise checklist?",
    "Can you give me examples to understand better?",
  ]
}

function buildSampleQuestionsResponse(input: {
  category?: string
  allowedTopics?: string[]
  assistantName?: string
  userName?: string | null
}) {
  const questions = getSampleQuestions(input)
  const namePrefix = input.userName ? `${input.userName}, ` : ""
  const assistantLabel = input.assistantName ? ` for ${input.assistantName}` : ""

  return [
    `${namePrefix}here are sample questions you can ask${assistantLabel}:`,
    ...questions.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n")
}

function buildPersonalAcknowledgement(input: {
  name?: string | null
  goals: string[]
  preferences: string[]
  interests: string[]
}) {
  if (input.name) {
    return `Nice to meet you, ${input.name}. I will remember your name and personalize our chat.`
  }

  if (input.goals.length) {
    return `Great goal. I will keep this in mind: ${input.goals[0]}.`
  }

  if (input.preferences.length) {
    return `Thanks for sharing your preference. I will adapt to: ${input.preferences[0]}.`
  }

  if (input.interests.length) {
    return `Great, I noted your interest in ${input.interests[0]}.`
  }

  return null
}

function isSimplePersonalInput(message: string) {
  const normalized = message.trim().toLowerCase()
  return (
    /^(hi|hello|hey|good morning|good evening)\b/.test(normalized) ||
    /\bmy name is\b/.test(normalized) ||
    /\bcall me\b/.test(normalized) ||
    /\bmy goal is\b/.test(normalized) ||
    /\bi (want to|am trying to|prefer|like|am interested in|'m interested in)\b/.test(normalized)
  )
}

function buildPrompt(
  message: string,
  agentPrompt?: string,
  agentCategory?: string,
  history?: Array<{ role: "user" | "model"; parts: string[] }>,
  memoryContext?: {
    responseStyle?: string | null
    language?: string | null
    relevantMemory?: Array<{ message: string; response: string }>
    profile?: {
      name: string | null
      goals: string[]
      preferences: string[]
      interests: string[]
    }
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
  sections.push(
    "Be natural and conversational. Never reject normal greetings or simple personal details like name, goals, or preferences. Acknowledge personal details and use them in future responses.",
  )
  sections.push(
    "If the user asks for sample questions, provide 5-7 practical sample questions tailored to this assistant's purpose. Keep responses concise and avoid repeating the same wording.",
  )
  sections.push("If you are uncertain, say 'I'm not certain' instead of guessing.")

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

  if (memoryContext?.profile) {
    const profileParts: string[] = []
    if (memoryContext.profile.name) {
      profileParts.push(`name: ${memoryContext.profile.name}`)
    }
    if (memoryContext.profile.goals.length) {
      profileParts.push(`goals: ${memoryContext.profile.goals.join(", ")}`)
    }
    if (memoryContext.profile.preferences.length) {
      profileParts.push(`preferences: ${memoryContext.profile.preferences.join(", ")}`)
    }
    if (memoryContext.profile.interests.length) {
      profileParts.push(`interests: ${memoryContext.profile.interests.join(", ")}`)
    }

    if (profileParts.length) {
      sections.push(`Known user profile: ${profileParts.join("; ")}`)
    }
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

    const { message, agentPrompt, agentCategory, agentConfig, history, botId } = payload.data
    const domainValidation = validateAgentDomain(message, agentCategory, agentPrompt, agentConfig)
    const userId = session?.user?.id || null
    const memoryContext = userId ? await buildMemoryContext(userId, message, botId) : null
    const inferredPreferences = userId ? inferPreferenceUpdate(message) : {}
    const personalSignals = extractPersonalSignalsFromMessage(message)

    const predefined = matchPredefinedResponse(message)
    if (predefined) {
      return NextResponse.json({ success: true, text: predefined, model: "predefined" }, { headers: { "Cache-Control": "no-store" } })
    }

    if (isSampleQuestionRequest(message)) {
      const text = buildSampleQuestionsResponse({
        category: agentCategory,
        allowedTopics: agentConfig.allowedTopics,
        assistantName: agentConfig.name,
        userName: memoryContext?.profile?.name || personalSignals.name || null,
      })

      if (userId) {
        await storeChatMemory({
          userId,
          botId,
          message,
          response: text,
          isImportant: true,
        })
      }

      return NextResponse.json({ success: true, text, model: "sample-questions" }, { headers: { "Cache-Control": "no-store" } })
    }

    if (isSimplePersonalInput(message)) {
      const acknowledgement = buildPersonalAcknowledgement(personalSignals)
      if (acknowledgement) {
        if (userId) {
          await storeChatMemory({
            userId,
            botId,
            message,
            response: acknowledgement,
            isImportant: true,
          })
        }

        return NextResponse.json({ success: true, text: acknowledgement, model: "personal-ack" }, { headers: { "Cache-Control": "no-store" } })
      }
    }

    if (domainValidation.enforced && !domainValidation.allowed) {
      return NextResponse.json({ success: true, text: domainValidation.rejectionText, model: "domain-guard" })
    }

    const redis = getRedisClient()
    const cacheKey =
      userId
        ? buildCacheKey({
            userId,
            botId,
            message,
            agentCategory,
            responseStyle: memoryContext?.preferences?.response_style || null,
            language: memoryContext?.preferences?.language || null,
          })
        : null

    if (redis && cacheKey) {
      const cached = await redis.get<string>(cacheKey)
      if (cached) {
        return NextResponse.json(
          { success: true, text: cached, model: "redis-cache", memoryEnabled: Boolean(userId) },
          { headers: { "Cache-Control": "no-store" } },
        )
      }
    }

    const apiKey = resolveGeminiApiKey(botId)
    if (!apiKey) {
      return jsonError(500, "Missing Environment Variable", "Server is missing GOOGLE_AI_API_KEY (or GOOGLE_AI_API_KEY_CHAT_2 for bot 2)")
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
        botId,
        message,
        response: text,
        isImportant: true,
      })
    }

    if (redis && cacheKey) {
      await redis.set(cacheKey, text, { ex: 60 * 30 }).catch(() => null)
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
      const cachedResponse = await buildMemoryContext(userId, "", undefined).then((context) => context.cachedResponse).catch(() => null)
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