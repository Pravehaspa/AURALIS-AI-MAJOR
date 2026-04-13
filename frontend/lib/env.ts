const REQUIRED_SERVER_ENV_KEYS = [
  "GOOGLE_AI_API_KEY",
  "MURF_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
] as const

const INVALID_SERVER_ENV_PATTERNS: Partial<Record<(typeof REQUIRED_SERVER_ENV_KEYS)[number], RegExp>> = {
  DATABASE_URL: /\[your-password\]|\[your_password\]|your_password|real_password|replace-with|<password>/i,
}

type RequiredServerEnvKey = (typeof REQUIRED_SERVER_ENV_KEYS)[number]

export function getMissingServerEnvKeys(env: NodeJS.ProcessEnv = process.env): RequiredServerEnvKey[] {
  return REQUIRED_SERVER_ENV_KEYS.filter((key) => !env[key] || String(env[key]).trim().length === 0)
}

export function getInvalidServerEnvKeys(env: NodeJS.ProcessEnv = process.env): RequiredServerEnvKey[] {
  return REQUIRED_SERVER_ENV_KEYS.filter((key) => {
    const value = env[key]
    const pattern = INVALID_SERVER_ENV_PATTERNS[key]
    if (!value || !pattern) {
      return false
    }

    return pattern.test(String(value))
  })
}

export function hasRequiredServerEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return getMissingServerEnvKeys(env).length === 0 && getInvalidServerEnvKeys(env).length === 0
}

export function maskSecret(value?: string): string {
  if (!value) {
    return "<missing>"
  }

  if (value.length <= 8) {
    return "*".repeat(value.length)
  }

  return `${value.slice(0, 4)}${"*".repeat(value.length - 8)}${value.slice(-4)}`
}

export function getServerEnvStatus(env: NodeJS.ProcessEnv = process.env) {
  const missing = getMissingServerEnvKeys(env)
  const invalid = getInvalidServerEnvKeys(env)

  return {
    isReady: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    configured: REQUIRED_SERVER_ENV_KEYS.filter((key) => !missing.includes(key) && !invalid.includes(key)),
  }
}

export { REQUIRED_SERVER_ENV_KEYS }
