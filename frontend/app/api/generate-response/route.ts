import { type NextRequest, NextResponse } from "next/server"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

// OpenRouter model IDs (provider/model). Try in order; first success wins.
const MODEL_IDS = [
  "google/gemini-2.0-flash",
  "google/gemini-2.0-flash-001",
  "google/gemini-1.5-flash",
  "google/gemini-1.5-pro",
  "google/gemini-pro",
  "google/gemini-2.5-flash-preview-05-20",
  "google/gemini-2.5-pro-preview-05-06",
] as const

export async function POST(request: NextRequest) {
  try {
    const { message, agentPrompt, model: requestedModel, messages: historyMessages } = await request.json()

    if (!message && !historyMessages) {
      return NextResponse.json({ error: "Message or messages array is required" }, { status: 400 })
    }

    const rawKey = process.env.OPENROUTER_API_KEY
    const apiKey = typeof rawKey === "string" ? rawKey.trim() : ""
    if (!apiKey || apiKey === "your_openrouter_api_key_here") {
      return NextResponse.json(
        {
          error:
            "OpenRouter API key is not configured. Set OPENROUTER_API_KEY in .env or .env.local (project root) and restart the dev server. Get a key at https://openrouter.ai/keys",
        },
        { status: 500 }
      )
    }

    const systemContent =
      agentPrompt ||
      `You are a friendly and talkative AI assistant. Respond to the user's message in a conversational and engaging way. Keep your responses informative but not too long (2-3 sentences max).`

    // Use provided history if available, otherwise fallback to single turn
    const openRouterMessages = historyMessages || [
      { role: "system", content: systemContent },
      { role: "user", content: message },
    ]

    const modelIdsToTry =
      requestedModel && typeof requestedModel === "string" && requestedModel.trim()
        ? [requestedModel.trim(), ...MODEL_IDS.filter((m) => m !== requestedModel.trim())]
        : [...MODEL_IDS]

    let lastError: Error | null = null
    for (const modelId of modelIdsToTry) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: openRouterMessages,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          const errMsg = data?.error?.message || data?.message || res.statusText
          throw new Error(errMsg)
        }

        const text =
          data?.choices?.[0]?.message?.content?.trim() ??
          data?.choices?.[0]?.text?.trim()
        if (text) {
          return NextResponse.json({ text })
        }
        throw new Error("Empty response from model")
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        continue
      }
    }

    const errMsg = lastError?.message ?? "Unknown error"
    let errorMessage = "Failed to generate response"
    if (
      errMsg.includes("API key") ||
      errMsg.includes("401") ||
      (errMsg.toLowerCase().includes("invalid") && errMsg.toLowerCase().includes("key"))
    ) {
      errorMessage =
        "Invalid OpenRouter API key. Set OPENROUTER_API_KEY in .env (get one at https://openrouter.ai/keys) and restart the dev server."
    } else if (errMsg.toLowerCase().includes("quota") || errMsg.includes("429")) {
      errorMessage = "API quota exceeded. Please try again later."
    } else if (
      errMsg.toLowerCase().includes("model") ||
      errMsg.includes("404") ||
      errMsg.toLowerCase().includes("not found")
    ) {
      errorMessage = `No model responded. Tried: ${modelIdsToTry.join(", ")}. ${errMsg.slice(0, 150)}`
    } else {
      errorMessage = errMsg.slice(0, 300)
    }

    return NextResponse.json({ error: errorMessage, details: errMsg }, { status: 500 })
  } catch (error) {
    console.error("Error generating response:", error)
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errMsg.slice(0, 300), details: errMsg },
      { status: 500 }
    )
  }
}
