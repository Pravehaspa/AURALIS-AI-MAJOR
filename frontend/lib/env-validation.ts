/**
 * Environment configuration validation
 * Validates all required environment variables at startup
 */

import { z } from "zod"

// Define the environment schema
const EnvSchema = z.object({
  // Required
  GOOGLE_AI_API_KEY: z.string().min(1, "GOOGLE_AI_API_KEY is required"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  MURF_API_KEY: z.string().min(1, "MURF_API_KEY is required"),

  // Optional
  GEMINI_MODEL: z.string().optional(),
  TELEMETRY_ENDPOINT: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
})

export type Env = z.infer<typeof EnvSchema>

let validatedEnv: Env | null = null
let validationError: Error | null = null

/**
 * Validate and cache environment variables
 * Throws if validation fails in production
 */
export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv
  }

  if (validationError) {
    throw validationError
  }

  try {
    const result = EnvSchema.safeParse(process.env)

    if (!result.success) {
      const errors = result.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join("\n")
      const error = new Error(`Environment validation failed:\n${errors}`)

      // Only cache error in development to allow fixes
      if (process.env.NODE_ENV !== "development") {
        validationError = error
      }

      throw error
    }

    validatedEnv = result.data
    return validatedEnv
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error
    }

    // In development, log but don't throw for some missing optional vars
    console.warn("Environment validation warning:", error)
    return {
      GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || "development-key",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "development-anon-key",
      MURF_API_KEY: process.env.MURF_API_KEY || "development-key",
      NODE_ENV: process.env.NODE_ENV,
    }
  }
}

/**
 * Get a specific environment variable with validation
 */
export function getEnv(key: keyof Env): string | undefined {
  const env = validateEnv()
  return env[key]
}

/**
 * Check if environment is production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production"
}
