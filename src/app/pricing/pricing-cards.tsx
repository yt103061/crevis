'use client'

import { useState } from 'react'
import Link from 'next/link'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '¥0',
    period: '',
    features: [
      'LP閲覧 20件/月',
      'AIスコア表示',
      'ニュースレター受信',
      'キーワード検索',
    ],
    limitations: [
      'AIコメント全文はブラー',
      '意味検索は利用不可',
    ],
    cta: null,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '¥980',
    period: '/月',
    yearlyPrice: '¥9,800/年',
    features: [
      '無制限LP閲覧',
      'AIコメント全文表示',
      'ニュースレター全文',
      '意味検索（自然言語）',
      'コレクション無制限',
    ],
    limitations: [],
    cta: 'pro_monthly',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: '¥2,980',
    period: '/月（5名まで）',
    features: [
      'Proの全機能',
      '共有コレクション',
      'チームメモ',
      'メンバー管理',
    ],
    limitations: [],
    cta: 'team_monthly',
  },
]

export function PricingCards({ currentPlan, isLoggedIn }: { currentPlan: string; isLoggedIn: boolean }) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(priceId: string) {
    setLoading(priceId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error ?? 'エラーが発生しました')
      }
    } catch {
      alert('通信エラーが発生しました')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className={`glass rounded-2xl p-6 relative flex flex-col ${
            plan.popular ? 'ring-2 ring-[#111111]/20' : ''
          }`}
        >
          {plan.popular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-[#111111] text-white">
              おすすめ
            </div>
          )}

          <div className="mb-5">
            <h3 className="text-lg font-bold text-[#111111] mb-1">{plan.name}</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-[#111111] font-num">{plan.price}</span>
              {plan.period && <span className="text-sm text-[#767b74]">{plan.period}</span>}
            </div>
            {plan.yearlyPrice && (
              <p className="text-xs text-[#767b74] mt-1">または {plan.yearlyPrice}（2ヶ月分お得）</p>
            )}
          </div>

          <ul className="space-y-2.5 mb-6 flex-1">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-[#323632]">
                <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
            {plan.limitations.map((l) => (
              <li key={l} className="flex items-start gap-2 text-sm text-[#8a8f88]">
                <svg className="w-4 h-4 text-[#b0b5ae] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {l}
              </li>
            ))}
          </ul>

          {currentPlan === plan.id ? (
            <div className="text-center py-2.5 rounded-xl text-sm font-medium text-[#5e625c] bg-[#f1f1ee] border border-[#d9dbd6]">
              現在のプラン
            </div>
          ) : plan.cta ? (
            isLoggedIn ? (
              <button
                onClick={() => handleCheckout(plan.cta!)}
                disabled={loading === plan.cta}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                  plan.popular ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {loading === plan.cta ? '処理中...' : `${plan.name}にアップグレード`}
              </button>
            ) : (
              <Link href="/login?redirect=/pricing" className="block text-center btn-secondary w-full py-2.5 rounded-xl text-sm font-semibold">
                ログインしてアップグレード
              </Link>
            )
          ) : (
            <div className="text-center py-2.5 rounded-xl text-sm text-[#8a8f88] bg-[#f7f7f5] border border-[#e3e5e0]">
              無料で利用中
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
