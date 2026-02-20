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
  const session = await getSession()
  const adminEmail = process.env.ADMIN_EMAIL

  if (!session || session.user.email !== adminEmail) {
    return null
  }
  return session
}
