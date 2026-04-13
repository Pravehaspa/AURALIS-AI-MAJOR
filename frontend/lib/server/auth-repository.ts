import "server-only"

import type { PoolClient } from "pg"
import { query, withTransaction } from "@/lib/server/db"

export type ResponseStyle = "short" | "detailed" | "with examples"

export type DbUser = {
  id: string
  name: string
  email: string
  image: string | null
  provider: string
  created_at: string
  updated_at: string
}

export type DbUserPreferences = {
  user_id: string
  theme: string
  notifications: boolean
  response_style: ResponseStyle
  language: string | null
  voice_enabled: boolean
  volume_level: number
  last_login: string | null
  deleted_at: string | null
  updated_at: string
}

let usersImageColumnExists: boolean | null = null
let preferencesTableName: "preferences" | "user_preferences" | null = null

async function hasUsersImageColumn(): Promise<boolean> {
  if (usersImageColumnExists !== null) {
    return usersImageColumnExists
  }

  const result = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'image'
      ) AS exists
    `,
  )

  usersImageColumnExists = Boolean(result.rows[0]?.exists)
  return usersImageColumnExists
}

async function getPreferencesTableName(): Promise<"preferences" | "user_preferences"> {
  if (preferencesTableName) {
    return preferencesTableName
  }

  const result = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'preferences'
      ) AS exists
    `,
  )

  preferencesTableName = result.rows[0]?.exists ? "preferences" : "user_preferences"
  return preferencesTableName
}

function userSelectSql(includeImage: boolean) {
  return includeImage
    ? "SELECT id, name, email, image, provider, created_at, updated_at"
    : "SELECT id, name, email, provider, created_at, updated_at"
}

function userReturnSql(includeImage: boolean) {
  return includeImage
    ? "RETURNING id, name, email, image, provider, created_at, updated_at"
    : "RETURNING id, name, email, provider, created_at, updated_at"
}

function mapPreferencesRow(
  row:
    | {
        user_id: string
        theme?: string | null
        notifications?: boolean | null
        response_style?: ResponseStyle | null
        language?: string | null
        voice_enabled?: boolean | null
        volume_level?: number | null
        last_login?: string | null
        deleted_at?: string | null
        updated_at: string
      }
    | undefined
    | null,
  tableName: "preferences" | "user_preferences",
): DbUserPreferences | null {
  if (!row) {
    return null
  }

  if (tableName === "preferences") {
    return {
      user_id: row.user_id,
      theme: row.theme || "dark",
      notifications: row.notifications ?? true,
      response_style: row.response_style || "detailed",
      language: row.language ?? "en",
      voice_enabled: row.voice_enabled ?? true,
      volume_level: row.volume_level ?? 1,
      last_login: row.last_login ?? null,
      deleted_at: row.deleted_at ?? null,
      updated_at: row.updated_at,
    }
  }

  return {
    user_id: row.user_id,
    theme: "dark",
    notifications: true,
    response_style: row.response_style || "detailed",
    language: row.language ?? "en",
    voice_enabled: true,
    volume_level: 1,
    last_login: null,
    deleted_at: null,
    updated_at: row.updated_at,
  }
}

function mapUserRow<T extends { image?: string | null }>(row: T | undefined | null, includeImage: boolean): DbUser | null {
  if (!row) {
    return null
  }

  const user = row as unknown as DbUser

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    provider: user.provider,
    created_at: user.created_at,
    updated_at: user.updated_at,
    image: includeImage ? row.image ?? null : null,
  }
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const includeImage = await hasUsersImageColumn()
  const result = await query<DbUser>(
    `
      ${userSelectSql(includeImage)}
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email.toLowerCase()],
  )

  return mapUserRow(result.rows[0], includeImage)
}

export async function findUserById(id: string): Promise<DbUser | null> {
  const includeImage = await hasUsersImageColumn()
  const result = await query<DbUser>(
    `
      ${userSelectSql(includeImage)}
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  )

  return mapUserRow(result.rows[0], includeImage)
}

export async function getUserPreferences(userId: string): Promise<DbUserPreferences | null> {
  const tableName = await getPreferencesTableName()
  const result = await query<DbUserPreferences>(
    tableName === "preferences"
      ? `
        SELECT user_id, theme, notifications, response_style, language, voice_enabled, volume_level, last_login, deleted_at, updated_at
        FROM preferences
        WHERE user_id = $1
        LIMIT 1
      `
      : `
        SELECT user_id, response_style, language, updated_at
        FROM user_preferences
        WHERE user_id = $1
        LIMIT 1
      `,
    [userId],
  )

  return mapPreferencesRow(result.rows[0], tableName)
}

export async function getUserProfile(userId: string): Promise<DbUser | null> {
  return findUserById(userId)
}

export type SyncUserInput = {
  id: string
  email: string
  name?: string | null
  image?: string | null
  provider?: string | null
}

export async function syncUserWithDatabase(input: SyncUserInput): Promise<DbUser> {
  const includeImage = await hasUsersImageColumn()
  const userColumns = includeImage ? "id, name, email, image, provider" : "id, name, email, provider"
  const userValues = includeImage ? "$1, $2, $3, $4, $5" : "$1, $2, $3, $4"
  const userParams = includeImage
    ? [input.id, input.name?.trim() || "User", input.email.toLowerCase(), input.image || null, input.provider || "email"]
    : [input.id, input.name?.trim() || "User", input.email.toLowerCase(), input.provider || "email"]

  const syncedUserResult = await query<DbUser>(
    `
      INSERT INTO users (${userColumns})
      VALUES (${userValues})
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        provider = EXCLUDED.provider,
        ${includeImage ? "image = COALESCE(EXCLUDED.image, users.image)," : ""}
        updated_at = NOW()
      ${userReturnSql(includeImage)}
    `,
    userParams,
  )

  const syncedUser = mapUserRow(syncedUserResult.rows[0], includeImage)
  if (!syncedUser) {
    throw new Error("Failed to sync user")
  }

  await upsertUserPreferences({
    userId: syncedUser.id,
    theme: "dark",
    language: "en",
    notifications: true,
    responseStyle: "detailed",
    voiceEnabled: true,
    volumeLevel: 1,
    lastLogin: new Date().toISOString(),
  }).catch(() => null)

  return syncedUser
}

export async function updateUserProfile(input: {
  userId: string
  name: string
  image?: string | null
}): Promise<DbUser> {
  const includeImage = await hasUsersImageColumn()
  const setClause = includeImage ? "name = $2, image = $3, updated_at = NOW()" : "name = $2, updated_at = NOW()"
  const params = includeImage ? [input.userId, input.name.trim(), input.image || null] : [input.userId, input.name.trim()]
  const result = await query<DbUser>(
    `
      UPDATE users
      SET ${setClause}
      WHERE id = $1
      ${userReturnSql(includeImage)}
    `,
    params,
  )

  return mapUserRow(result.rows[0], includeImage) as DbUser
}

export async function upsertUserPreferences(input: {
  userId: string
  theme?: string
  notifications?: boolean
  responseStyle?: ResponseStyle
  language?: string | null
  voiceEnabled?: boolean
  volumeLevel?: number
  lastLogin?: string | null
  deletedAt?: string | null
}): Promise<DbUserPreferences> {
  const tableName = await getPreferencesTableName()
  const theme = input.theme || "dark"
  const notifications = input.notifications ?? true
  const responseStyle = input.responseStyle || "detailed"
  const language = input.language?.trim() || "en"
  const voiceEnabled = input.voiceEnabled ?? true
  const volumeLevel = typeof input.volumeLevel === "number" ? input.volumeLevel : 1
  const lastLogin = input.lastLogin || null
  const deletedAt = input.deletedAt || null

  if (tableName === "preferences") {
    const result = await query<DbUserPreferences>(
      `
        INSERT INTO preferences (user_id, theme, language, notifications, response_style, voice_enabled, volume_level, last_login, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id)
        DO UPDATE SET
          theme = EXCLUDED.theme,
          language = EXCLUDED.language,
          notifications = EXCLUDED.notifications,
          response_style = EXCLUDED.response_style,
          voice_enabled = EXCLUDED.voice_enabled,
          volume_level = EXCLUDED.volume_level,
          last_login = COALESCE(EXCLUDED.last_login, preferences.last_login),
          deleted_at = EXCLUDED.deleted_at,
          updated_at = NOW()
        RETURNING user_id, theme, notifications, response_style, language, voice_enabled, volume_level, last_login, deleted_at, updated_at
      `,
      [input.userId, theme, language, notifications, responseStyle, voiceEnabled, volumeLevel, lastLogin, deletedAt],
    )

    return result.rows[0]
  }

  const result = await query<DbUserPreferences>(
    `
      INSERT INTO user_preferences (user_id, response_style, language)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id)
      DO UPDATE SET
        response_style = EXCLUDED.response_style,
        language = EXCLUDED.language,
        updated_at = NOW()
      RETURNING user_id, response_style, language, updated_at
    `,
    [input.userId, responseStyle, language],
  )

  return mapPreferencesRow(result.rows[0], tableName) as DbUserPreferences
}

export async function ensureUserPreferences(userId: string): Promise<DbUserPreferences> {
  const existing = await getUserPreferences(userId)
  if (existing) {
    return existing
  }

  return upsertUserPreferences({ userId, responseStyle: "detailed" })
}

export async function runUserLookup(client: PoolClient, email: string): Promise<DbUser | null> {
  const includeImage = usersImageColumnExists ?? false
  const result = await client.query<DbUser>(
    `
      ${userSelectSql(includeImage)}
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email.toLowerCase()],
  )

  return mapUserRow(result.rows[0], includeImage)
}

export async function withDbTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  return withTransaction(handler)
}
