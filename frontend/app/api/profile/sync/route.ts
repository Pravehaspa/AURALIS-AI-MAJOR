import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { toPublicDbError } from "@/lib/server/db-errors"

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json(
    {
      success: false,
      error,
      message,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  )
}

export async function POST() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return jsonError(401, "Unauthorized", "Please sign in to sync your profile")
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          provider: session.user.provider,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Profile sync failed:", error)
    const dbError = toPublicDbError(error)
    return jsonError(dbError.status, dbError.error, dbError.message)
  }
}
