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

  if (!isLoggedIn) {
    return (
      <Link
        href="/login"
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 text-gray-500 text-sm rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors"
      >
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
      }
    } catch {
      // エラー時は状態を元に戻す
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        collected
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : 'border-2 border-indigo-300 text-indigo-600 hover:bg-indigo-50'
      } disabled:opacity-50`}
    >
      <svg
        className="w-4 h-4"
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
      {collected ? 'コレクション済み' : 'コレクションに保存'}
    </button>
  )
}
