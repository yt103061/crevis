'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { isSupabaseBrowserConfigured, supabase } from '@/lib/supabase'

export function Header() {
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase()
  const isAdmin = !!user?.email && !!adminEmail && user.email.toLowerCase() === adminEmail

  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) {
      return
    }

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setUser(data.session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    if (!isSupabaseBrowserConfigured()) {
      return
    }

    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(7, 7, 15, 0.82)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* ロゴ */}
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              C
            </div>
            <span className="font-bold text-white text-lg tracking-tight">CreVis</span>
            <span
              className="hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(99,102,241,0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.25)',
              }}
            >
              LPギャラリー
            </span>
          </Link>

          {/* ナビ */}
          <nav className="flex items-center gap-0.5">
            <NavLink href="/search">検索</NavLink>
            <NavLink href="/newsletter">ニュースレター</NavLink>
            {user ? (
              <>
                <NavLink href="/dashboard">コレクション</NavLink>
                {isAdmin && <NavLink href="/admin">管理画面</NavLink>}
                <button
                  onClick={signOut}
                  className="ml-1 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-white/5"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="ml-2 px-4 py-1.5 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                ログイン
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-100 rounded-lg hover:bg-white/5 transition-all"
    >
      {children}
    </Link>
  )
}
