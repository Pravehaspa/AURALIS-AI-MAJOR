import { NextResponse } from "next/server"
import { z } from "zod"

const speechRequestSchema = z.object({
  text: z.string().min(1, "Text is required").max(5000),
  voiceId: z.string().min(1).max(100).optional(),
})

export async function POST(request: Request) {
  try {
    const apiKey = process.env.MURF_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Server is missing MURF_API_KEY" }, { status: 500 })
    }

    const payload = speechRequestSchema.safeParse(await request.json())
    if (!payload.success) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    const { text, voiceId } = payload.data
    const requestBody = {
      text,
      voiceId: voiceId || "en-US-terrell",
      rate: 1,
      pitch: 1,
      volumeGain: 0,
      engine: "neural",
      contentType: "application/json",
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const murfResponse = await fetch("https://api.murf.ai/v1/speech/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      const responseText = await murfResponse.text()
      let parsed: any = null

      try {
        parsed = responseText ? JSON.parse(responseText) : null
      } catch {
        parsed = null
      }

      if (!murfResponse.ok) {
        const message = parsed?.message || parsed?.error || responseText || "Murf API request failed"
        return NextResponse.json({ error: message }, { status: murfResponse.status })
      }

      const audioUrl = parsed?.audioFile || parsed?.url || parsed?.audioUrl
      if (!audioUrl) {
        return NextResponse.json({ error: "Murf API did not return an audio URL" }, { status: 500 })
      }

      return NextResponse.json({ audioUrl })
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    console.error("Error converting text to speech:", error)
    return NextResponse.json(
      {
        error: "Failed to convert text to speech",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}