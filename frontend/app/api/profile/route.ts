import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { getUserProfile } from "@/lib/server/auth-repository"
import { toPublicDbError } from "@/lib/server/db-errors"
import { incrementSecurityCounter } from "@/lib/monitoring"

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
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      await incrementSecurityCounter("auth_error")
      return jsonError(401, "Unauthorized", "Please sign in to view your profile")
    }

    const user = await getUserProfile(session.user.id)
    if (!user) {
      return jsonError(404, "Profile Not Found", "We could not find your account profile")
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          provider: user.provider,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          hasPassword: user.provider !== "google",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Profile fetch failed:", error)
    const dbError = toPublicDbError(error)
    return jsonError(dbError.status, dbError.error, dbError.message)
  }
}
