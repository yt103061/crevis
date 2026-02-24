import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'

function isSupabaseAuthConfigured() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function createServerSupabaseClient() {
  if (!isSupabaseAuthConfigured()) {
    return null
  }

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
  if (!supabase) {
    return null
  }

  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function requireAdminAuth() {
  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return null
  }

  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL

  if (!user || user.email !== adminEmail) {
    return null
  }
  return user
}
