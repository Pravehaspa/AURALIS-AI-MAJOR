import { NextResponse } from "next/server"
import { createSupabaseServerClient, getSupabaseServerEnvError } from "@/lib/supabase/server"
import { syncUserWithDatabase } from "@/lib/server/auth-repository"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") || "/dashboard"
  const target = new URL(next, request.url)

  console.log("[auth-callback] incoming callback", {
    hasCode: Boolean(code),
    next,
    url: requestUrl.toString(),
  })

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    console.error("[auth-callback] supabase unavailable", {
      error: getSupabaseServerEnvError(),
    })
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("error", getSupabaseServerEnvError() || "Supabase is not configured")
    return NextResponse.redirect(loginUrl)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("[auth-callback] exchangeCodeForSession failed", {
        message: error.message,
      })
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("error", error.message || "OAuth login failed")
      return NextResponse.redirect(loginUrl)
    }

    console.log("[auth-callback] code exchange successful")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.email) {
    console.log("[auth-callback] user found after callback", {
      userId: user.id,
      email: user.email,
      provider: typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email",
    })
    try {
      await syncUserWithDatabase({
        id: user.id,
        email: user.email,
        name: typeof user.user_metadata?.name === "string" ? user.user_metadata.name : user.email.split("@")[0],
        image: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
        provider: typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email",
      })
    } catch (error) {
      console.error("[auth-callback] user sync failed", error)
    }
  } else {
    console.error("[auth-callback] no user found in session after callback")
  }

  console.log("[auth-callback] redirecting", { target: target.toString() })

  return NextResponse.redirect(target)
}
