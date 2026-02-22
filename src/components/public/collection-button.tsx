'use client'

import { useState } from 'react'
import Link from 'next/link'

interface CollectionButtonProps {
  lpId: string
  isCollected: boolean
  isLoggedIn: boolean
}

export function CollectionButton({ lpId, isCollected, isLoggedIn }: CollectionButtonProps) {
  const [collected, setCollected] = useState(isCollected)
  const [loading, setLoading] = useState(false)
  const [animating, setAnimating] = useState(false)

  if (!isLoggedIn) {
    return (
      <Link
        href="/login"
        className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm text-slate-400 transition-all hover:text-indigo-400"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px dashed rgba(255,255,255,0.1)',
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        ログインしてコレクションに保存
      </Link>
    )
  }

  async function toggle() {
    setLoading(true)
    try {
      if (collected) {
        await fetch(`/api/collections?lp_id=${lpId}`, { method: 'DELETE' })
        setCollected(false)
      } else {
        await fetch('/api/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lp_id: lpId }),
        })
        setCollected(true)
        setAnimating(true)
        setTimeout(() => setAnimating(false), 600)
      }
    } catch {
      // restore on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
        collected
          ? ''
          : ''
      } ${animating ? 'animate-scale-in' : ''}`}
      style={
        collected
          ? {
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#a5b4fc',
            }
          : {
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8',
            }
      }
    >
      <svg
        className={`w-4 h-4 transition-transform ${animating ? 'scale-125' : ''}`}
        fill={collected ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
      {loading ? '処理中...' : collected ? 'コレクション済み' : 'コレクションに保存'}
    </button>
  )
}
