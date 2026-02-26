import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import type { PlanType } from '@/types'
import { createServiceClient } from '@/lib/supabase'

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

// ユーザーのプランを取得
export async function getUserPlan(userId: string): Promise<PlanType> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()
  return (data?.plan as PlanType) ?? 'free'
}

// NL全文閲覧権限（reader, pro, team）
export function canAccessFullNewsletter(plan: PlanType): boolean {
  return plan === 'reader' || plan === 'pro' || plan === 'team'
}

// LP全機能権限（pro, team）
export function canAccessFullLP(plan: PlanType): boolean {
  return plan === 'pro' || plan === 'team'
}
