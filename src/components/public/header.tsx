'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { PlanType } from '@/types'

const PLAN_BADGE: Record<PlanType, { label: string; cls: string } | null> = {
  free: null,
  reader: { label: 'Reader', cls: 'bg-[#eef2ff] text-[#1d4ed8]' },
  pro: { label: 'Pro', cls: 'bg-amber-100 text-amber-700' },
  team: { label: 'Team', cls: 'bg-amber-100 text-amber-700' },
}

export function Header() {
  const [user, setUser] = useState<{ email?: string; id?: string } | null>(null)
  const [plan, setPlan] = useState<PlanType>('free')
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      if (data.user) {
        setUser({ email: data.user.email, id: data.user.id })
        // Fetch plan from profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', data.user.id)
          .maybeSingle()
        if (mounted && profile?.plan) setPlan(profile.plan as PlanType)
      } else {
        setUser(null)
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setUser({ email: session.user.email, id: session.user.id })
      } else {
        setUser(null)
        setPlan('free')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  const navItems = [
    { href: '/search', label: '検索' },
    { href: '/newsletter', label: 'ニュースレター' },
    { href: '/pricing', label: '料金' },
    ...(user ? [{ href: '/dashboard', label: 'コレクション' }] : []),
  ]

  return (
    <header className="sticky top-0 z-50 bg-[#f7f7f5]/95 border-b border-[#d9dbd6] backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight text-[#111]">CreVis</span>
            <span className="text-[10px] tracking-[0.12em] uppercase text-[#6b7068]">LP Intelligence</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label }) => (
              <NavLink key={href} href={href} active={pathname === href}>
                {label}
              </NavLink>
            ))}
            {user ? (
              <div className="flex items-center gap-2 ml-2">
                {(() => {
                  const badge = PLAN_BADGE[plan]
                  return badge ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  ) : (
                    <Link href="/pricing" className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f1ee] text-[#5e625c] hover:bg-[#eef2ff] hover:text-[#1d4ed8] transition-colors">
                      アップグレード
                    </Link>
                  )
                })()}
                <button
                  onClick={signOut}
                  className="px-3 py-1.5 text-sm text-[#6b7068] hover:text-[#111] rounded-md"
                >
                  ログアウト
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <Link href="/login" className="px-3 py-1.5 text-sm text-[#5e625c] hover:text-[#111] rounded-md transition-colors">
                  ログイン
                </Link>
                <Link href="/login?mode=signup" className="btn-primary">
                  無料で始める
                </Link>
              </div>
            )}
          </nav>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 -mr-2 rounded-md hover:bg-[#eceee9]"
            aria-label="メニュー"
          >
            <svg className="w-5 h-5 text-[#2f342f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[#d9dbd6] bg-[#f7f7f5]">
          <div className="px-4 py-3 space-y-1">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center px-3 py-2 text-sm rounded-md ${
                  pathname === href ? 'bg-[#eceee9] text-[#111]' : 'text-[#50554f]'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="pt-2 border-t border-[#d9dbd6] space-y-1">
              {user ? (
                <>
                  {(() => {
                    const badge = PLAN_BADGE[plan]
                    return badge ? (
                      <div className="px-3 py-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}プラン
                        </span>
                      </div>
                    ) : (
                      <Link href="/pricing" className="block px-3 py-2 text-sm text-[#1d4ed8] rounded-md">
                        アップグレード
                      </Link>
                    )
                  })()}
                  <button onClick={signOut} className="w-full text-left px-3 py-2 text-sm text-[#50554f] rounded-md">
                    ログアウト
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="block px-3 py-2 text-sm text-[#50554f] rounded-md">
                    ログイン
                  </Link>
                  <Link href="/login?mode=signup" className="block text-center btn-primary w-full">
                    無料で始める
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
        active ? 'bg-[#eceee9] text-[#111] font-medium' : 'text-[#5e625c] hover:text-[#111]'
      }`}
    >
      {children}
    </Link>
  )
}
