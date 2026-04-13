import "server-only"

import { query } from "@/lib/server/db"
import type { DbUserPreferences, ResponseStyle } from "@/lib/server/auth-repository"
import { getUserPreferences } from "@/lib/server/auth-repository"

export type ChatMemoryRecord = {
  id: string
  user_id: string
  message: string
  response: string
  timestamp: string
  is_important: boolean
}

export type MemoryContext = {
  preferences: DbUserPreferences | null
  relevantMemory: ChatMemoryRecord[]
  cachedResponse: string | null
}

const MEMORY_LIMIT = 10

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ")
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 3)
}

function scoreMemory(queryText: string, memory: ChatMemoryRecord) {
  const queryTokens = new Set(tokenize(queryText))
  if (queryTokens.size === 0) {
    return 0
  }

  const memoryTokens = new Set([...tokenize(memory.message), ...tokenize(memory.response)])
  let score = 0
  for (const token of queryTokens) {
    if (memoryTokens.has(token)) {
      score += 2
    }
  }

  if (memory.message.toLowerCase().includes(queryText.toLowerCase())) {
    score += 3
  }

  return score
}

export function inferPreferenceUpdate(message: string): { responseStyle?: ResponseStyle; language?: string } {
  const normalized = message.toLowerCase()

  if (/(short answers?|be brief|keep it short|concise)/.test(normalized)) {
    return { responseStyle: "short" }
  }

  if (/(detailed|in detail|thorough)/.test(normalized)) {
    return { responseStyle: "detailed" }
  }

  if (/(with examples|give examples|show examples)/.test(normalized)) {
    return { responseStyle: "with examples" }
  }

  const languageMatch = normalized.match(/(?:speak|respond|reply|talk) in ([a-z\- ]{2,30})/)
  if (languageMatch?.[1]) {
    return { language: languageMatch[1].trim() }
  }

  return {}
}

export async function storeChatMemory(input: {
  userId: string
  message: string
  response: string
  isImportant?: boolean
}) {
  await query(
    `
      INSERT INTO chat_memory (user_id, message, response, is_important)
      VALUES ($1, $2, $3, $4)
    `,
    [input.userId, input.message, input.response, input.isImportant ?? true],
  )

  await query(
    `
      DELETE FROM chat_memory
      WHERE id IN (
        SELECT id
        FROM chat_memory
        WHERE user_id = $1
        ORDER BY timestamp DESC
        OFFSET $2
      )
    `,
    [input.userId, MEMORY_LIMIT],
  )
}

export async function getRecentChatMemory(userId: string, limit = 5): Promise<ChatMemoryRecord[]> {
  const result = await query<ChatMemoryRecord>(
    `
      SELECT id, user_id, message, response, timestamp, is_important
      FROM chat_memory
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `,
    [userId, limit],
  )

  return result.rows
}

export async function getRelevantChatMemory(userId: string, message: string, limit = 3): Promise<ChatMemoryRecord[]> {
  const recent = await getRecentChatMemory(userId, 10)
  return recent
    .map((entry) => ({ entry, score: scoreMemory(message, entry) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ entry }) => entry)
}

export async function getCachedFallbackResponse(userId: string, message: string): Promise<string | null> {
  const relevant = await getRelevantChatMemory(userId, message, 1)
  return relevant[0]?.response || null
}

export async function buildMemoryContext(userId: string, message: string): Promise<MemoryContext> {
  const [preferences, relevantMemory, cachedResponse] = await Promise.all([
    getUserPreferences(userId),
    getRelevantChatMemory(userId, message, 3),
    getCachedFallbackResponse(userId, message),
  ])

  return {
    preferences,
    relevantMemory,
    cachedResponse,
  }
}
