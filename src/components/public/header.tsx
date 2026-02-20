'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function Header() {
  const [user, setUser] = useState<{ email?: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* ロゴ */}
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-indigo-600 text-xl">CreVis</span>
            <span className="text-xs text-gray-400 hidden sm:block">成果の出るLPギャラリー</span>
          </Link>

          {/* ナビ */}
          <nav className="flex items-center gap-4">
            <Link href="/search" className="text-sm text-gray-600 hover:text-gray-900">
              検索
            </Link>
            <Link href="/newsletter" className="text-sm text-gray-600 hover:text-gray-900">
              ニュースレター
            </Link>
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  コレクション
                </Link>
                <button
                  onClick={signOut}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ログアウト
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
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
