import { describe, expect, it } from "vitest"
import { getInvalidServerEnvKeys, getMissingServerEnvKeys, hasRequiredServerEnv, maskSecret } from "./env"

describe("env utilities", () => {
  it("detects missing required keys", () => {
    const missing = getMissingServerEnvKeys({
      GOOGLE_AI_API_KEY: "abc",
      MURF_API_KEY: "def",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "ghi",
      DATABASE_URL: "postgresql://example",
    } as unknown as NodeJS.ProcessEnv)

    expect(missing).toContain("NEXT_PUBLIC_SUPABASE_URL")
  })

  it("returns true when all required keys exist", () => {
    const ok = hasRequiredServerEnv({
      GOOGLE_AI_API_KEY: "abc",
      MURF_API_KEY: "def",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "jkl",
      DATABASE_URL: "postgresql://example",
    } as unknown as NodeJS.ProcessEnv)

    expect(ok).toBe(true)
  })

  it("detects invalid placeholder values", () => {
    const invalid = getInvalidServerEnvKeys({
      GOOGLE_AI_API_KEY: "abc",
      MURF_API_KEY: "def",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "jkl",
      DATABASE_URL: "postgresql://postgres:[YOUR-PASSWORD]@db.example.supabase.co:5432/postgres",
    } as unknown as NodeJS.ProcessEnv)

    expect(invalid).toContain("DATABASE_URL")
  })

  it("masks secrets safely", () => {
    expect(maskSecret("1234567890")).toBe("1234**7890")
    expect(maskSecret("")).toBe("<missing>")
  })
})
