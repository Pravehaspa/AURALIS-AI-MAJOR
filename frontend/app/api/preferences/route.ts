import { NextResponse } from "next/server"
import { z } from "zod"
import { getAuthSession } from "@/lib/auth"
import { getUserPreferences, upsertUserPreferences } from "@/lib/server/auth-repository"
import { checkRateLimit } from "@/lib/rate-limiter"
import { incrementSecurityCounter } from "@/lib/monitoring"

const preferenceSchema = z.object({
  responseStyle: z.enum(["short", "detailed", "with examples"]).optional(),
  language: z.string().max(120).optional(),
})

function jsonError(status: number, error: string, message: string, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    { status, headers: { "Cache-Control": "no-store" } },
  )
}

export async function GET() {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    await incrementSecurityCounter("auth_error")
    return jsonError(401, "Unauthorized", "Please sign in to access preferences")
  }

  try {
    const preferences = await getUserPreferences(session.user.id)
    return NextResponse.json(
      {
        success: true,
        data: preferences || {
          user_id: session.user.id,
          response_style: "detailed",
          language: null,
          updated_at: new Date().toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Failed to load preferences:", error)
    return jsonError(500, "Internal Server Error", "Failed to load preferences")
  }
}

export async function PUT(request: Request) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    await incrementSecurityCounter("auth_error")
    return jsonError(401, "Unauthorized", "Please sign in to update preferences")
  }

  const rateLimit = await checkRateLimit(`preferences:${session.user.id}`)
  if (!rateLimit.allowed) {
    await incrementSecurityCounter("rate_limited")
    return jsonError(429, "Rate Limited", "Too many preference updates. Please try again later.")
  }

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      await incrementSecurityCounter("invalid_request")
      return jsonError(400, "Invalid JSON", "Request body must be valid JSON")
    }

    const payload = preferenceSchema.safeParse(body)
    if (!payload.success) {
      await incrementSecurityCounter("invalid_request")
      return jsonError(
        400,
        "Invalid request format",
        "Preference payload validation failed",
        payload.error.errors.map((item) => `${item.path.join(".")}: ${item.message}`),
      )
    }

    const preferences = await upsertUserPreferences({
      userId: session.user.id,
      responseStyle: payload.data.responseStyle,
      language: payload.data.language,
    })

    return NextResponse.json({ success: true, data: preferences }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Failed to update preferences:", error)
    return jsonError(500, "Internal Server Error", "Failed to update preferences")
  }
}
