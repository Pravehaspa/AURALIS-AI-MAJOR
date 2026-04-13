import "server-only"

import { Pool, type PoolClient, type QueryResultRow } from "pg"
import { isDatabaseUrlPlaceholder } from "@/lib/server/db-errors"

declare global {
  // eslint-disable-next-line no-var
  var __auralisPgPool: Pool | undefined
}

function normalizeDbUrl(value?: string | null): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function validateDatabaseUrlFormat(databaseUrl: string) {
  if (isDatabaseUrlPlaceholder(databaseUrl)) {
    throw new Error("DATABASE_URL contains a placeholder password")
  }

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error("Invalid DATABASE_URL")
  }

  if (!(parsed.protocol === "postgresql:" || parsed.protocol === "postgres:")) {
    throw new Error("Invalid DATABASE_URL protocol")
  }
}

function resolveDatabaseConnectionUrl(): string {
  const directUrl = normalizeDbUrl(process.env.DATABASE_URL)
  const poolerUrl = normalizeDbUrl(process.env.DATABASE_URL_POOLER)
  const usePooler = process.env.DATABASE_URL_USE_POOLER === "1"

  if (!directUrl) {
    throw new Error("DATABASE_URL is required")
  }

  validateDatabaseUrlFormat(directUrl)

  if (!poolerUrl) {
    return directUrl
  }

  validateDatabaseUrlFormat(poolerUrl)

  return usePooler ? poolerUrl : directUrl
}

function createPool() {
  const databaseUrl = resolveDatabaseConnectionUrl()

  return new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    max: 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  })
}

export function getPool() {
  if (!global.__auralisPgPool) {
    global.__auralisPgPool = createPool()
  }

  return global.__auralisPgPool
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params)
}

export async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    const result = await handler(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
