import { createBrowserClient } from "@supabase/ssr"

let browserClient: ReturnType<typeof createBrowserClient> | null = null
let envError: string | null = null

function isProbablyJwt(value: string) {
  return value.split(".").length === 3
}

export function getSupabaseRuntimeValidation() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const hasUrl = Boolean(url)
  const hasAnonKey = Boolean(anonKey)
  const urlLooksValid = hasUrl ? /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(url)) : false
  const anonKeyLooksValid = hasAnonKey ? isProbablyJwt(String(anonKey)) : false

  return {
    hasUrl,
    hasAnonKey,
    urlLooksValid,
    anonKeyLooksValid,
  }
}

function readBrowserEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[supabase] Browser env missing", {
      hasUrl: Boolean(supabaseUrl),
      hasAnonKey: Boolean(supabaseAnonKey),
    })
    envError = "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    return null
  }

  console.log("[supabase] Browser env loaded", {
    hasUrl: true,
    hasAnonKey: true,
  })

  const validation = getSupabaseRuntimeValidation()
  if (!validation.urlLooksValid || !validation.anonKeyLooksValid) {
    console.warn("[supabase] Runtime validation warning", validation)
  }

  envError = null
  return { supabaseUrl, supabaseAnonKey }
}

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient
  }

  const env = readBrowserEnv()
  if (!env) {
    return null
  }

  browserClient = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey)
  return browserClient
}

export function getSupabaseBrowserEnvError() {
  if (envError) {
    return envError
  }

  readBrowserEnv()
  return envError
}
