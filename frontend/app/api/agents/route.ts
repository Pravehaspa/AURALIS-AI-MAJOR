import { NextResponse } from "next/server"
import { z } from "zod"
import { getAuthSession } from "@/lib/auth"
import { createCustomAgent, listAgentsForUser } from "@/lib/server/agent-repository"

const createAgentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  category: z.string().min(1).max(80),
  domain: z.string().min(1).max(200),
  purpose: z.string().max(300).optional(),
  tone: z.string().max(40).optional(),
  allowedTopics: z.array(z.string().min(1).max(120)).min(1),
  restrictedTopics: z.array(z.string().min(1).max(120)).optional(),
  prompt: z.string().min(1).max(7000),
  firstMessage: z.string().min(1).max(600),
  voiceId: z.string().min(1).max(100),
  knowledgeText: z.string().max(12000).optional(),
  samplePrompts: z.array(z.string().min(1).max(200)).max(8).optional(),
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

export async function GET() {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return jsonError(401, "Unauthorized", "Please sign in")
  }

  try {
    const agents = await listAgentsForUser(session.user.id)
    return NextResponse.json({ success: true, data: agents }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return jsonError(500, "Internal Server Error", error instanceof Error ? error.message : "Failed to load agents")
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return jsonError(401, "Unauthorized", "Please sign in")
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, "Invalid JSON", "Request body must be valid JSON")
  }

  const parsed = createAgentSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(400, "Invalid request", parsed.error.errors.map((item) => `${item.path.join(".")}: ${item.message}`).join("; "))
  }

  try {
    const agent = await createCustomAgent({
      userId: session.user.id,
      ...parsed.data,
    })
    return NextResponse.json({ success: true, data: agent }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return jsonError(500, "Internal Server Error", error instanceof Error ? error.message : "Failed to create agent")
  }
}
