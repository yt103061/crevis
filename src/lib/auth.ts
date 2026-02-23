import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'

export function createServerSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

export async function getSession() {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function requireAdminAuth() {
  const supabase = createServerSupabaseClient()
  const adminEmail = process.env.ADMIN_EMAIL?.trim()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    console.error('[Admin Auth] No session found')
    return null
  }

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    console.error('[Admin Auth] getUser failed, falling back to session user:', error?.message)
    if (session.user.email === adminEmail) {
      return session.user
    }
    return null
  }

  if (user.email !== adminEmail) {
    console.error(`[Admin Auth] Email mismatch: user=${user.email}, admin=${adminEmail}`)
    return null
  }

  return user
}
