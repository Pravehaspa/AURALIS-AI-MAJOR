import "server-only"

import { query } from "@/lib/server/db"
import type { DbUserPreferences, ResponseStyle } from "@/lib/server/auth-repository"
import { getUserPreferences } from "@/lib/server/auth-repository"

export type ChatMemoryRecord = {
  id: string
  user_id: string
  bot_id?: string | null
  message: string
  response: string
  timestamp: string
  is_important: boolean
}

export type MemoryContext = {
  preferences: DbUserPreferences | null
  relevantMemory: ChatMemoryRecord[]
  cachedResponse: string | null
  profile: {
    name: string | null
    goals: string[]
    preferences: string[]
    interests: string[]
  }
}

const MEMORY_LIMIT = 10
let hasBotIdColumnCache: boolean | null = null

async function hasChatMemoryBotIdColumn(): Promise<boolean> {
  if (hasBotIdColumnCache !== null) {
    return hasBotIdColumnCache
  }

  const result = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'chat_memory'
          AND column_name = 'bot_id'
      ) AS exists
    `,
  )

  hasBotIdColumnCache = Boolean(result.rows[0]?.exists)
  return hasBotIdColumnCache
}

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

function normalizeFact(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!,;:\s]+$/, "")
}

function extractName(message: string): string | null {
  const patterns = [
    /\bmy name is\s+([a-z][a-z\s'-]{1,40})/i,
    /\bcall me\s+([a-z][a-z\s'-]{1,40})/i,
    /^\s*i am\s+([a-z][a-z\s'-]{1,40})\s*$/i,
    /^\s*i'm\s+([a-z][a-z\s'-]{1,40})\s*$/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (!match?.[1]) {
      continue
    }

    const candidate = normalizeFact(match[1])
    if (candidate.length < 2 || candidate.split(" ").length > 4) {
      continue
    }

    return candidate
  }

  return null
}

function extractFacts(message: string, patterns: RegExp[]): string[] {
  const facts: string[] = []

  for (const pattern of patterns) {
    for (const match of message.matchAll(pattern)) {
      const raw = match[1]
      if (!raw) {
        continue
      }

      const fact = normalizeFact(raw)
      if (fact.length < 3) {
        continue
      }

      facts.push(fact)
    }
  }

  return Array.from(new Set(facts)).slice(0, 4)
}

export function extractPersonalSignalsFromMessage(message: string) {
  return {
    name: extractName(message),
    goals: extractFacts(message, [
      /\bmy goal is\s+([^.!?\n]{3,120})/gi,
      /\bi want to\s+([^.!?\n]{3,120})/gi,
      /\bi am trying to\s+([^.!?\n]{3,120})/gi,
      /\bi'm trying to\s+([^.!?\n]{3,120})/gi,
      /\bi need to\s+([^.!?\n]{3,120})/gi,
    ]),
    preferences: extractFacts(message, [
      /\bi prefer\s+([^.!?\n]{3,120})/gi,
      /\bplease\s+([^.!?\n]{3,120})/gi,
      /\buse\s+([^.!?\n]{3,120})/gi,
    ]),
    interests: extractFacts(message, [
      /\bi like\s+([^.!?\n]{3,120})/gi,
      /\bi am interested in\s+([^.!?\n]{3,120})/gi,
      /\bi'm interested in\s+([^.!?\n]{3,120})/gi,
      /\bi enjoy\s+([^.!?\n]{3,120})/gi,
    ]),
  }
}

function buildProfileFromMemories(memories: ChatMemoryRecord[]) {
  let name: string | null = null
  const goals: string[] = []
  const preferences: string[] = []
  const interests: string[] = []

  for (let index = memories.length - 1; index >= 0; index -= 1) {
    const entry = memories[index]
    const signals = extractPersonalSignalsFromMessage(entry.message)

    if (signals.name) {
      name = signals.name
    }

    for (const value of signals.goals) {
      if (!goals.includes(value)) {
        goals.push(value)
      }
    }

    for (const value of signals.preferences) {
      if (!preferences.includes(value)) {
        preferences.push(value)
      }
    }

    for (const value of signals.interests) {
      if (!interests.includes(value)) {
        interests.push(value)
      }
    }
  }

  return {
    name,
    goals: goals.slice(0, 3),
    preferences: preferences.slice(0, 3),
    interests: interests.slice(0, 3),
  }
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
  botId?: string
  message: string
  response: string
  isImportant?: boolean
}) {
  const hasBotIdColumn = await hasChatMemoryBotIdColumn()

  if (hasBotIdColumn) {
    await query(
      `
        INSERT INTO chat_memory (user_id, bot_id, message, response, is_important)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [input.userId, input.botId || null, input.message, input.response, input.isImportant ?? true],
    )
  } else {
    await query(
      `
        INSERT INTO chat_memory (user_id, message, response, is_important)
        VALUES ($1, $2, $3, $4)
      `,
      [input.userId, input.message, input.response, input.isImportant ?? true],
    )
  }

  if (hasBotIdColumn) {
    await query(
      `
        DELETE FROM chat_memory
        WHERE id IN (
          SELECT id
          FROM chat_memory
          WHERE user_id = $1
            AND COALESCE(bot_id, '') = COALESCE($2, '')
          ORDER BY timestamp DESC
          OFFSET $3
        )
      `,
      [input.userId, input.botId || null, MEMORY_LIMIT],
    )
  } else {
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
}

export async function getRecentChatMemory(userId: string, limit = 5, botId?: string): Promise<ChatMemoryRecord[]> {
  const hasBotIdColumn = await hasChatMemoryBotIdColumn()
  const result = hasBotIdColumn
    ? await query<ChatMemoryRecord>(
        `
          SELECT id, user_id, bot_id, message, response, timestamp, is_important
          FROM chat_memory
          WHERE user_id = $1
            AND COALESCE(bot_id, '') = COALESCE($2, '')
          ORDER BY timestamp DESC
          LIMIT $3
        `,
        [userId, botId || null, limit],
      )
    : await query<ChatMemoryRecord>(
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

export async function getRelevantChatMemory(
  userId: string,
  message: string,
  limit = 3,
  botId?: string,
): Promise<ChatMemoryRecord[]> {
  const recent = await getRecentChatMemory(userId, 10, botId)
  return recent
    .map((entry) => ({ entry, score: scoreMemory(message, entry) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ entry }) => entry)
}

export async function getCachedFallbackResponse(userId: string, message: string, botId?: string): Promise<string | null> {
  const relevant = await getRelevantChatMemory(userId, message, 1, botId)
  return relevant[0]?.response || null
}

export async function buildMemoryContext(userId: string, message: string, botId?: string): Promise<MemoryContext> {
  const [preferences, relevantMemory, cachedResponse, recentMemory] = await Promise.all([
    getUserPreferences(userId),
    getRelevantChatMemory(userId, message, 3, botId),
    getCachedFallbackResponse(userId, message, botId),
    getRecentChatMemory(userId, 10, botId),
  ])

  return {
    preferences,
    relevantMemory,
    cachedResponse,
    profile: buildProfileFromMemories(recentMemory),
  }
}
