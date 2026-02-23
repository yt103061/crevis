import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 環境変数が未設定の環境（Preview/ローカル等）では
  // Middlewareでクラッシュさせず通常レスポンスを返す
  if (!supabaseUrl || !supabaseAnonKey) {
    return res
  }

  try {
    // セッションをCookieに同期する（これがないとサーバー側でログイン状態を読めない）
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
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
    console.error('Middleware Supabase sync failed:', error)
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
