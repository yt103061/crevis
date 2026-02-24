import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isSupabaseEnvConfigured() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Edgeで環境変数不足時にMIDDLEWARE_INVOCATION_FAILEDを起こさない
  if (!isSupabaseEnvConfigured()) {
    return res
  }

  try {
    // セッションをCookieに同期する（これがないとサーバー側でログイン状態を読めない）
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return req.cookies.get(name)?.value
          },
          set(name, value, options) {
            req.cookies.set({ name, value, ...options })
            res.cookies.set({ name, value, ...options })
          },
          remove(name, options) {
            req.cookies.set({ name, value: '', ...options })
            res.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    await supabase.auth.getSession()
  } catch (error) {
    console.error('middleware supabase sync failed:', error)
    // middlewareで落とさずに画面表示を優先
    return res
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
