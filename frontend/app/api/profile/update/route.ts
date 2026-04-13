import { NextResponse } from "next/server"
import { z } from "zod"
import { getAuthSession } from "@/lib/auth"
import { updateUserProfile } from "@/lib/server/auth-repository"
import { toPublicDbError } from "@/lib/server/db-errors"
import { checkRateLimit } from "@/lib/rate-limiter"
import { incrementSecurityCounter } from "@/lib/monitoring"

const updateProfileSchema = z.object({
  name: z.string().min(2).max(120),
  image: z.string().max(200000).optional().nullable(),
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

export async function PUT(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      await incrementSecurityCounter("auth_error")
      return jsonError(401, "Unauthorized", "Please sign in to update your profile")
    }

    const rateLimit = await checkRateLimit(`profile:update:${session.user.id}`)
    if (!rateLimit.allowed) {
      await incrementSecurityCounter("rate_limited")
      return jsonError(429, "Rate Limited", "Too many profile updates. Please try again later.")
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      await incrementSecurityCounter("invalid_request")
      return jsonError(400, "Invalid JSON", "Request body must be valid JSON")
    }

    const payload = updateProfileSchema.safeParse(body)
    if (!payload.success) {
      await incrementSecurityCounter("invalid_request")
      const details = payload.error.errors.map((item) => `${item.path.join(".")}: ${item.message}`)
      return jsonError(400, "Invalid request format", details.join(" | ") || "Profile payload validation failed", details)
    }

    const updatedUser = await updateUserProfile({
      userId: session.user.id,
      name: payload.data.name.trim(),
      image: payload.data.image || null,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        image: updatedUser.image,
        provider: updatedUser.provider,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at,
      },
    })
  } catch (error) {
    console.error("Profile update failed:", error)
    const dbError = toPublicDbError(error)
    return jsonError(dbError.status, dbError.error, dbError.message)
  }
}
