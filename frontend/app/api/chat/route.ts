import { handleChatRequest } from "@/lib/server/chat-response"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json(
    {
      success: false,
      error,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}

export async function POST(request: Request) {
  try {
    return await handleChatRequest(request)
  } catch (error) {
    return jsonError(
      500,
      "Internal Server Error",
      error instanceof Error ? error.message : "Unknown error",
    )
  }
}

export async function GET() {
  return jsonError(405, "Method Not Allowed", "Use POST /api/chat")
}

export async function PUT() {
  return jsonError(405, "Method Not Allowed", "Use POST /api/chat")
}

export async function PATCH() {
  return jsonError(405, "Method Not Allowed", "Use POST /api/chat")
}

export async function DELETE() {
  return jsonError(405, "Method Not Allowed", "Use POST /api/chat")
}