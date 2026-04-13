import { NextResponse } from "next/server"
import { z } from "zod"
import { getAuthSession } from "@/lib/auth"
import { createSupabaseServerClient, getSupabaseServerEnvError } from "@/lib/supabase/server"
import { toPublicDbError } from "@/lib/server/db-errors"
import { checkRateLimit } from "@/lib/rate-limiter"
import { incrementSecurityCounter } from "@/lib/monitoring"

const changePasswordSchema = z.object({
  newPassword: z.string().min(8).max(200),
  confirmPassword: z.string().min(8).max(200),
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

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      await incrementSecurityCounter("auth_error")
      return jsonError(401, "Unauthorized", "Please sign in to change your password")
    }

    const rateLimit = await checkRateLimit(`profile:password:${session.user.id}`)
    if (!rateLimit.allowed) {
      await incrementSecurityCounter("rate_limited")
      return jsonError(429, "Rate Limited", "Too many password attempts. Please try again later.")
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      await incrementSecurityCounter("invalid_request")
      return jsonError(400, "Invalid JSON", "Request body must be valid JSON")
    }

    const payload = changePasswordSchema.safeParse(body)
    if (!payload.success) {
      await incrementSecurityCounter("invalid_request")
      const details = payload.error.errors.map((item) => `${item.path.join(".")}: ${item.message}`)
      return jsonError(400, "Invalid request format", details.join(" | ") || "Password payload validation failed", details)
    }

    if (payload.data.newPassword !== payload.data.confirmPassword) {
      return jsonError(400, "Password Mismatch", "New password and confirmation do not match")
    }

    const supabase = await createSupabaseServerClient()
    if (!supabase) {
      return jsonError(500, "Server Misconfigured", getSupabaseServerEnvError() || "Supabase is not configured")
    }

    const { error } = await supabase.auth.updateUser({
      password: payload.data.newPassword,
    })

    if (error) {
      return jsonError(400, "Password Update Failed", error.message || "Unable to update password")
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    })
  } catch (error) {
    console.error("Password change failed:", error)
    const dbError = toPublicDbError(error)
    return jsonError(dbError.status, dbError.error, dbError.message)
  }
}
