import "server-only"

export type PublicDbError = {
  status: number
  error: string
  message: string
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  return "Unknown database error"
}

export function isDatabaseUrlPlaceholder(value?: string | null): boolean {
  if (!value) {
    return false
  }

  const normalized = value.toLowerCase().trim()
  return (
    normalized.includes("[your-password]") ||
    normalized.includes("[your_password]") ||
    normalized.includes("your_password") ||
    normalized.includes("real_password") ||
    normalized.includes("replace-with") ||
    normalized.includes("<password>")
  )
}

export function toPublicDbError(error: unknown): PublicDbError {
  const message = normalizeErrorMessage(error)
  const lower = message.toLowerCase()

  if (lower.includes("database_url is required")) {
    return {
      status: 503,
      error: "Database URL Missing",
      message: "DATABASE_URL is missing. Add your Supabase PostgreSQL connection string.",
    }
  }

  if (lower.includes("database_url contains a placeholder password")) {
    return {
      status: 503,
      error: "Database URL Invalid",
      message: "DATABASE_URL still uses a placeholder password. Replace it with your real Supabase DB password.",
    }
  }

  if (lower.includes("invalid database_url")) {
    return {
      status: 503,
      error: "Database URL Invalid",
      message:
        "DATABASE_URL format is invalid. Use postgresql://postgres:YOUR_PASSWORD@db.<project>.supabase.co:5432/postgres. If direct connection fails on IPv4 networks, configure DATABASE_URL_POOLER and set DATABASE_URL_USE_POOLER=1.",
    }
  }

  if (lower.includes("password authentication failed")) {
    return {
      status: 503,
      error: "Database Authentication Failed",
      message: "Database credentials are invalid. Verify the Supabase DB password in DATABASE_URL.",
    }
  }

  if (
    lower.includes("etimedout") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("connect timeout") ||
    lower.includes("connection timeout") ||
    lower.includes("connection terminated") ||
    lower.includes("connection terminated unexpectedly")
  ) {
    return {
      status: 503,
      error: "Database Unreachable",
      message:
        "Unable to reach the database host. Check Supabase host, port access, and network connectivity. For IPv4-only environments, use the Supabase pooler URL in DATABASE_URL_POOLER and set DATABASE_URL_USE_POOLER=1.",
    }
  }

  return {
    status: 500,
    error: "Database Error",
    message: "A database operation failed unexpectedly.",
  }
}
