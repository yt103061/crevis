'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function Header() {
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
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

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  const navItems = [
    { href: '/search', label: '検索', icon: SearchIcon },
    { href: '/newsletter', label: 'ニュースレター', icon: MailIcon },
    { href: '/pricing', label: '料金', icon: SparkleIcon },
    ...(user ? [{ href: '/dashboard', label: 'コレクション', icon: BookmarkIcon }] : []),
  ]

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(7, 7, 15, 0.85)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 transition-transform group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              C
            </div>
            <span className="font-bold text-white text-lg tracking-tight">CreVis</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <NavLink key={href} href={href} active={pathname === href}>
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
            {user ? (
              <button
                onClick={signOut}
                className="ml-2 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-white/5"
              >
                ログアウト
              </button>
            ) : (
              <Link href="/login" className="btn-primary ml-3">
                ログイン
              </Link>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2.5 -mr-2 rounded-xl hover:bg-white/5 transition-colors"
            aria-label="メニュー"
          >
            <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden animate-fade-in"
          style={{
            background: 'rgba(7, 7, 15, 0.97)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="px-4 py-3 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-colors ${
                  pathname === href
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {user ? (
                <button
                  onClick={signOut}
                  className="w-full text-left px-4 py-3 text-sm text-slate-400 rounded-xl hover:bg-white/5"
                >
                  ログアウト
                </button>
              ) : (
                <Link href="/login" className="block text-center btn-primary w-full">
                  ログイン
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl transition-all ${
        active
          ? 'bg-indigo-500/10 text-indigo-400 font-medium'
          : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
      }`}
    >
      {children}
    </Link>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}
