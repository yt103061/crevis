import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

function buildUnconfiguredClient() {
  const error = { message: 'Supabase is not configured' }

  const terminalResult = {
    data: null,
    error,
    count: 0,
  }

  const chain = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (resolve: (value: typeof terminalResult) => void) => resolve(terminalResult)
        }
        if (prop === 'catch') {
          return () => chain
        }
        if (prop === 'finally') {
          return () => chain
        }
        return () => chain
      },
    }
  )

  return {
    from() {
      return chain
    },
  }
}

// クライアント側ではcreateClientComponentClientを使いCookieにセッションを保存する
// （これによりサーバー側でも認証状態を読める）
let _supabase: ReturnType<typeof createBrowserClient> | null = null

export function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase browser client is not configured')
    return buildUnconfiguredClient() as unknown as ReturnType<typeof createBrowserClient>
  }

  if (!_supabase) {
    _supabase = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey
    )
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

export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseKey = supabaseServiceRoleKey ?? supabaseAnonKey

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase service client is not configured')
    return buildUnconfiguredClient() as unknown as ReturnType<typeof createClient>
  }

  return createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
