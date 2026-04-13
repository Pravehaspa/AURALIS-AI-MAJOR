import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"

const protectedPrefixes = ["/chat", "/dashboard", "/settings", "/profile"]
const AUTH_DISABLED = true

export async function proxy(request: NextRequest) {
  if (AUTH_DISABLED) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { success: false, error: "Server Misconfigured", message: "Supabase environment variables are missing" },
      { status: 500 },
    )
  }

  const { pathname } = request.nextUrl
  const isProtectedPage = protectedPrefixes.some((prefix) => pathname.startsWith(prefix))
  const isPreferencesApi = pathname.startsWith("/api/preferences")
  const isProfileApi = pathname.startsWith("/api/profile")

  if (!isProtectedPage && !isPreferencesApi && !isProfileApi) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    return response
  }

  if (isPreferencesApi || isProfileApi) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", message: "Please sign in to continue" },
      { status: 401 },
    )
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("callbackUrl", pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    "/chat/:path*",
    "/dashboard/:path*",
    "/settings/:path*",
    "/profile",
    "/profile/:path*",
    "/api/preferences/:path*",
    "/api/profile",
    "/api/profile/:path*",
  ],
}
