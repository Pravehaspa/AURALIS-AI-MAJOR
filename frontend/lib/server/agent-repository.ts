import "server-only"

import type { QueryResultRow } from "pg"
import { DEFAULT_AGENTS } from "@/lib/default-agents"
import type { Agent } from "@/lib/types"
import { query } from "@/lib/server/db"

type DbAgentRow = QueryResultRow & {
  id: string
  user_id: string
  name: string
  description: string
  category: string
  domain: string
  purpose: string | null
  tone: string | null
  allowed_topics: string[]
  restricted_topics: string[] | null
  prompt: string
  first_message: string
  voice_id: string
  knowledge_text: string | null
  sample_prompts: string[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const TABLE_NAME = "custom_agents"
let hasCustomAgentsTableCache: boolean | null = null

async function hasCustomAgentsTable() {
  if (hasCustomAgentsTableCache !== null) {
    return hasCustomAgentsTableCache
  }

  const result = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [TABLE_NAME],
  )

  hasCustomAgentsTableCache = Boolean(result.rows[0]?.exists)
  return hasCustomAgentsTableCache
}

function mapAgentRow(row: DbAgentRow): Agent {
  const tone = row.tone === "friendly" || row.tone === "professional" || row.tone === "strict" ? row.tone : undefined

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    domain: row.domain,
    purpose: row.purpose || undefined,
    tone,
    allowedTopics: row.allowed_topics || [],
    restrictedTopics: row.restricted_topics || [],
    prompt: row.prompt,
    firstMessage: row.first_message,
    voiceId: row.voice_id,
    knowledgeText: row.knowledge_text || undefined,
    samplePrompts: row.sample_prompts || undefined,
    isActive: row.is_active,
    conversations: 0,
    lastUsed: "Never",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listAgentsForUser(userId: string): Promise<Agent[]> {
  if (!(await hasCustomAgentsTable())) {
    return [...DEFAULT_AGENTS]
  }

  const result = await query<DbAgentRow>(
    `
      SELECT id, user_id, name, description, category, domain, purpose, tone, allowed_topics, restricted_topics,
             prompt, first_message, voice_id, knowledge_text, sample_prompts, is_active, created_at, updated_at
      FROM ${TABLE_NAME}
      WHERE user_id = $1
      ORDER BY updated_at DESC
    `,
    [userId],
  )

  const custom = result.rows.map(mapAgentRow)
  return [...DEFAULT_AGENTS, ...custom]
}

export async function createCustomAgent(input: {
  userId: string
  name: string
  description: string
  category: string
  domain: string
  purpose?: string
  tone?: string
  allowedTopics: string[]
  restrictedTopics?: string[]
  prompt: string
  firstMessage: string
  voiceId: string
  knowledgeText?: string
  samplePrompts?: string[]
}): Promise<Agent> {
  if (!(await hasCustomAgentsTable())) {
    throw new Error("custom_agents table is missing. Run latest migration first.")
  }

  const result = await query<DbAgentRow>(
    `
      INSERT INTO ${TABLE_NAME} (
        user_id, name, description, category, domain, purpose, tone,
        allowed_topics, restricted_topics, prompt, first_message, voice_id,
        knowledge_text, sample_prompts, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, true
      )
      RETURNING id, user_id, name, description, category, domain, purpose, tone, allowed_topics, restricted_topics,
                prompt, first_message, voice_id, knowledge_text, sample_prompts, is_active, created_at, updated_at
    `,
    [
      input.userId,
      input.name,
      input.description,
      input.category,
      input.domain,
      input.purpose || null,
      input.tone || null,
      input.allowedTopics,
      input.restrictedTopics || [],
      input.prompt,
      input.firstMessage,
      input.voiceId,
      input.knowledgeText || null,
      input.samplePrompts || [],
    ],
  )

  return mapAgentRow(result.rows[0])
}

export async function updateCustomAgent(
  userId: string,
  agentId: string,
  updates: Partial<{
    name: string
    description: string
    category: string
    domain: string
    purpose: string
    tone: string
    allowedTopics: string[]
    restrictedTopics: string[]
    prompt: string
    firstMessage: string
    voiceId: string
    knowledgeText: string
    samplePrompts: string[]
    isActive: boolean
  }>,
): Promise<Agent | null> {
  if (!(await hasCustomAgentsTable())) {
    return null
  }

  const fields: string[] = []
  const values: unknown[] = [userId, agentId]

  const push = (column: string, value: unknown) => {
    fields.push(`${column} = $${values.length + 1}`)
    values.push(value)
  }

  if (typeof updates.name === "string") push("name", updates.name)
  if (typeof updates.description === "string") push("description", updates.description)
  if (typeof updates.category === "string") push("category", updates.category)
  if (typeof updates.domain === "string") push("domain", updates.domain)
  if (typeof updates.purpose === "string") push("purpose", updates.purpose)
  if (typeof updates.tone === "string") push("tone", updates.tone)
  if (Array.isArray(updates.allowedTopics)) push("allowed_topics", updates.allowedTopics)
  if (Array.isArray(updates.restrictedTopics)) push("restricted_topics", updates.restrictedTopics)
  if (typeof updates.prompt === "string") push("prompt", updates.prompt)
  if (typeof updates.firstMessage === "string") push("first_message", updates.firstMessage)
  if (typeof updates.voiceId === "string") push("voice_id", updates.voiceId)
  if (typeof updates.knowledgeText === "string") push("knowledge_text", updates.knowledgeText)
  if (Array.isArray(updates.samplePrompts)) push("sample_prompts", updates.samplePrompts)
  if (typeof updates.isActive === "boolean") push("is_active", updates.isActive)

  if (fields.length === 0) {
    return null
  }

  fields.push("updated_at = NOW()")

  const result = await query<DbAgentRow>(
    `
      UPDATE ${TABLE_NAME}
      SET ${fields.join(", ")}
      WHERE user_id = $1 AND id = $2
      RETURNING id, user_id, name, description, category, domain, purpose, tone, allowed_topics, restricted_topics,
                prompt, first_message, voice_id, knowledge_text, sample_prompts, is_active, created_at, updated_at
    `,
    values,
  )

  return result.rows[0] ? mapAgentRow(result.rows[0]) : null
}

export async function deleteCustomAgent(userId: string, agentId: string): Promise<boolean> {
  if (!(await hasCustomAgentsTable())) {
    return false
  }

  const result = await query(
    `
      DELETE FROM ${TABLE_NAME}
      WHERE user_id = $1 AND id = $2
    `,
    [userId, agentId],
  )

  return (result.rowCount || 0) > 0
}
