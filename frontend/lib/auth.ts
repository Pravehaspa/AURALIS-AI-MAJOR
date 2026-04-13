import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { syncUserWithDatabase } from "@/lib/server/auth-repository"

export type AuthSession = {
  user: {
    id: string
    email: string
    name: string
    image: string | null
    provider: string
  }
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user?.email) {
    return null
  }

  const provider =
    typeof data.user.app_metadata?.provider === "string"
      ? data.user.app_metadata.provider
      : "email"

  const syncedUser = await syncUserWithDatabase({
    id: data.user.id,
    email: data.user.email,
    name:
      typeof data.user.user_metadata?.name === "string"
        ? data.user.user_metadata.name
        : data.user.email.split("@")[0],
    image:
      typeof data.user.user_metadata?.avatar_url === "string"
        ? data.user.user_metadata.avatar_url
        : null,
    provider,
  })

  return {
    user: {
      id: syncedUser.id,
      email: syncedUser.email,
      name: syncedUser.name,
      image: syncedUser.image,
      provider: syncedUser.provider,
    },
  }
}
