import { type NextRequest, NextResponse } from "next/server"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const AUDIO_MODEL = "openai/gpt-audio-mini"

const voiceMap: Record<string, string> = {
  "en-US-terrell": "onyx",
  "en-US-natalie": "nova",
  "en-US-ken": "echo",
  "en-US-julia": "shimmer",
  "en-US-miles": "fable",
  "en-GB-oliver": "alloy",
  "en-AU-sarah": "nova",
  "es-MX-valeria": "shimmer",
}

function pickOpenRouterVoice(voiceId?: string): string {
  if (!voiceId) return "alloy"
  return voiceMap[voiceId] || "alloy"
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

function pcm16ToWavBase64(pcmBytes: Uint8Array, sampleRate = 24000, channels = 1): string {
  const bytesPerSample = 2
  const byteRate = sampleRate * channels * bytesPerSample
  const blockAlign = channels * bytesPerSample
  const dataSize = pcmBytes.length
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true) // PCM fmt chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits per sample
  writeString(36, "data")
  view.setUint32(40, dataSize, true)

  const wavBytes = new Uint8Array(buffer)
  wavBytes.set(pcmBytes, 44)
  return Buffer.from(wavBytes).toString("base64")
}

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    const rawKey = process.env.OPENROUTER_API_KEY
    const apiKey = typeof rawKey === "string" ? rawKey.trim() : ""

    if (!apiKey || apiKey === "your_openrouter_api_key_here") {
      return NextResponse.json(
        {
          error:
            "OpenRouter API key is not configured. Set OPENROUTER_API_KEY in your environment variables.",
        },
        { status: 500 }
      )
    }

    const selectedVoice = pickOpenRouterVoice(voiceId)
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AUDIO_MODEL,
        messages: [
          {
            role: "user",
            content: text,
          },
        ],
        modalities: ["text", "audio"],
        audio: {
          voice: selectedVoice,
          format: "pcm16",
        },
        stream: true,
      }),
    })

    if (!response.ok || !response.body) {
      const errText = await response.text()
      return NextResponse.json(
        {
          error: `OpenRouter TTS error: HTTP ${response.status}`,
          details: errText.slice(0, 500),
        },
        { status: 500 }
      )
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    const audioChunks: string[] = []
    const transcriptChunks: string[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice("data: ".length).trim()
        if (data === "[DONE]") break
        if (!data) continue

        try {
          const chunk = JSON.parse(data)
          const audioDelta = chunk?.choices?.[0]?.delta?.audio
          if (audioDelta?.data) {
            audioChunks.push(audioDelta.data)
          }
          if (audioDelta?.transcript) {
            transcriptChunks.push(audioDelta.transcript)
          }
        } catch {
          // Ignore non-JSON keepalive lines
        }
      }
    }

    if (audioChunks.length === 0) {
      return NextResponse.json(
        {
          error: "No audio data received from OpenRouter TTS model.",
          details: transcriptChunks.join("").slice(0, 200),
        },
        { status: 500 }
      )
    }

    const pcmChunks = audioChunks.map((chunk) => Buffer.from(chunk, "base64"))
    const fullPcm = concatUint8Arrays(pcmChunks)
    const wavBase64 = pcm16ToWavBase64(fullPcm)
    const audioUrl = `data:audio/wav;base64,${wavBase64}`
    return NextResponse.json({
      audioUrl,
      transcript: transcriptChunks.join(""),
      provider: "openrouter",
      model: AUDIO_MODEL,
      voice: selectedVoice,
    })
  } catch (error: unknown) {
    console.error("Error converting text to speech:", error)

    const errMsg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "Failed to convert text to speech via OpenRouter",
        details: errMsg,
      },
      { status: 500 }
    )
  }
}
