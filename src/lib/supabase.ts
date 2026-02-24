import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export function isSupabaseBrowserConfigured() {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY
}

export function isSupabaseServiceConfigured() {
  return !!SUPABASE_URL && !!SUPABASE_SERVICE_ROLE_KEY
}

// クライアント側ではcreateClientComponentClientを使いCookieにセッションを保存する
// （これによりサーバー側でも認証状態を読める）
let _supabase: ReturnType<typeof createBrowserClient> | null = null

export function getSupabase() {
  if (!isSupabaseBrowserConfigured()) {
    throw new Error(
      'Supabase is not configured for this deployment environment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the current Vercel environment (Production/Preview/Development) and redeploy.'
    )
  }

  if (!_supabase) {
    _supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return _supabase
}

// クライアントコンポーネントから直接インポートできるようにProxy
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSupabase() as any)[prop]
  },
})

export function createServiceClient(options?: { requireServiceRole?: boolean }) {
  const requireServiceRole = options?.requireServiceRole ?? false

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase is not configured for this deployment environment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the current Vercel environment (Production/Preview/Development) and redeploy.'
    )
  }

  if (SUPABASE_SERVICE_ROLE_KEY) {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  if (requireServiceRole) {
    throw new Error(
      'Supabase service client is not configured. Set SUPABASE_SERVICE_ROLE_KEY for admin/cron operations.'
    )
  }

  // フロント表示を止めないため、service role未設定時はanonキーでフォールバック
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
