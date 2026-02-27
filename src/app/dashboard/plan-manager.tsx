'use client'

import { useState } from 'react'
import Link from 'next/link'

export function PlanManager({
  currentPlan,
  hasStripeCustomer,
}: {
  currentPlan: string
  hasStripeCustomer: boolean
}) {
  const [loading, setLoading] = useState(false)

  async function openPortal() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error ?? 'ポータルを開けませんでした')
      }
    } catch {
      alert('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  if (currentPlan === 'free') {
    return (
      <Link href="/pricing" className="btn-primary text-sm">
        アップグレード
      </Link>
    )
  }

  if (hasStripeCustomer) {
    return (
      <button
        onClick={openPortal}
        disabled={loading}
        className="btn-secondary text-sm disabled:opacity-50"
      >
        {loading ? '読み込み中...' : 'プラン管理'}
      </button>
    )
  }

  return (
    <Link href="/pricing" className="btn-secondary text-sm">
      プランを確認
    </Link>
  )
}
