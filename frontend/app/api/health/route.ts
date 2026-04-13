import { NextResponse } from "next/server"
import { query } from "@/lib/server/db"
import { toPublicDbError } from "@/lib/server/db-errors"

export async function GET() {
  try {
    await query("SELECT 1")
    return NextResponse.json(
      {
        success: true,
        status: "ok",
        database: "connected",
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    const dbError = toPublicDbError(error)
    return NextResponse.json(
      {
        success: false,
        status: "degraded",
        database: "unavailable",
        error: dbError.error,
        message: dbError.message,
      },
      { status: dbError.status, headers: { "Cache-Control": "no-store" } },
    )
  }
}
