import "server-only"

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

let envError: string | null = null

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    envError = "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    return null
  }

  envError = null
  return { supabaseUrl, supabaseAnonKey }
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const env = getSupabaseEnv()
  if (!env) {
    return null
  }

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 })
      },
    },
  })
}

export function getSupabaseServerEnvError() {
  if (envError) {
    return envError
  }

  getSupabaseEnv()
  return envError
}
