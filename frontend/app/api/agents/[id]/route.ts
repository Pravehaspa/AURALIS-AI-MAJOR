import { NextResponse } from "next/server"
import { z } from "zod"
import { getAuthSession } from "@/lib/auth"
import { deleteCustomAgent, updateCustomAgent } from "@/lib/server/agent-repository"

const updateAgentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(500).optional(),
  category: z.string().min(1).max(80).optional(),
  domain: z.string().min(1).max(200).optional(),
  purpose: z.string().max(300).optional(),
  tone: z.string().max(40).optional(),
  allowedTopics: z.array(z.string().min(1).max(120)).optional(),
  restrictedTopics: z.array(z.string().min(1).max(120)).optional(),
  prompt: z.string().min(1).max(7000).optional(),
  firstMessage: z.string().min(1).max(600).optional(),
  voiceId: z.string().min(1).max(100).optional(),
  knowledgeText: z.string().max(12000).optional(),
  samplePrompts: z.array(z.string().min(1).max(200)).max(8).optional(),
  isActive: z.boolean().optional(),
})

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json(
    {
      success: false,
      error,
      message,
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  )
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return jsonError(401, "Unauthorized", "Please sign in")
  }

  const { id } = await context.params
  if (!id.startsWith("default-")) {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonError(400, "Invalid JSON", "Request body must be valid JSON")
    }

    const parsed = updateAgentSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(400, "Invalid request", parsed.error.errors.map((item) => `${item.path.join(".")}: ${item.message}`).join("; "))
    }

    try {
      const updated = await updateCustomAgent(session.user.id, id, parsed.data)
      if (!updated) {
        return jsonError(404, "Not Found", "Agent not found")
      }
      return NextResponse.json({ success: true, data: updated }, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      return jsonError(500, "Internal Server Error", error instanceof Error ? error.message : "Failed to update agent")
    }
  }

  return jsonError(403, "Forbidden", "Default agents cannot be modified")
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return jsonError(401, "Unauthorized", "Please sign in")
  }

  const { id } = await context.params
  if (id.startsWith("default-")) {
    return jsonError(403, "Forbidden", "Default agents cannot be deleted")
  }

  try {
    const deleted = await deleteCustomAgent(session.user.id, id)
    if (!deleted) {
      return jsonError(404, "Not Found", "Agent not found")
    }
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return jsonError(500, "Internal Server Error", error instanceof Error ? error.message : "Failed to delete agent")
  }
}
