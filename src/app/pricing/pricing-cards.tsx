'use client'

import { useState } from 'react'
import Link from 'next/link'

type PlanKey = 'reader' | 'pro'

type Plan = {
  id: string
  name: string
  price: string
  period: string
  description: string
  features: string[]
  limitations: string[]
  cta: PlanKey | null
  ctaLabel: string
  highlight: boolean
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '¥0',
    period: '',
    description: 'まずは無料で試す',
    features: [
      'LPギャラリー閲覧',
      'AIスコア表示',
      'ニュースレター受信（件名のみ）',
      'キーワード検索',
      'コレクション3件まで',
    ],
    limitations: [
      'AIコメント全文はブラー',
      'NL本文・インサイト非表示',
    ],
    cta: null,
    ctaLabel: '無料で始める',
    highlight: false,
  },
  {
    id: 'reader',
    name: 'Reader',
    price: '¥500',
    period: '/月',
    description: 'ニュースレターをフルに読む',
    features: [
      'ニュースレター全文',
      'key_insights（深い洞察）',
      'actionable_tips（実践Tips）',
      'evidence_level 表示',
      'バックナンバー全アーカイブ',
      'コレクション3件まで',
    ],
    limitations: [
      'AIコメント全文はブラー',
    ],
    cta: 'reader',
    ctaLabel: 'Readerを始める',
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '¥1,480',
    period: '/月',
    description: 'CROプロフェッショナル向け',
    features: [
      'Readerの全機能',
      'LP閲覧無制限',
      'AIコメント全文表示',
      'コレクション無制限',
      '意味検索（自然言語）',
    ],
    limitations: [],
    cta: 'pro',
    ctaLabel: 'Proを始める',
    highlight: false,
  },
]

const FAQ = [
  {
    q: 'いつでも解約できますか？',
    a: 'はい、いつでも解約できます。解約後も期間終了まで利用でき、日割り返金はありません。',
  },
  {
    q: 'プラン変更はできますか？',
    a: 'はい、マイページのプラン管理から即時変更できます。差額は日割りで精算されます。',
  },
  {
    q: '支払い方法は？',
    a: 'クレジットカード（Visa / Mastercard / JCB 等）をStripe経由で安全に処理します。',
  },
]

export function PricingCards({
  currentPlan,
  isLoggedIn,
  priceIds,
}: {
  currentPlan: string
  isLoggedIn: boolean
  priceIds: { reader: string | null; pro: string | null }
}) {
  const [loading, setLoading] = useState<PlanKey | null>(null)

  async function handleCheckout(planKey: PlanKey) {
    const priceId = priceIds[planKey]
    if (!priceId) {
      alert('価格情報が取得できません。しばらく待ってから再度お試しください。')
      return
    }

    setLoading(planKey)
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
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`glass rounded-2xl p-6 relative flex flex-col ${
              plan.highlight ? 'ring-2 ring-[#1d4ed8]' : ''
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-[#1d4ed8] text-white whitespace-nowrap">
                おすすめ
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#111111] mb-0.5">{plan.name}</h3>
              <p className="text-xs text-[#767b74] mb-3">{plan.description}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-[#111111]">{plan.price}</span>
                {plan.period && <span className="text-sm text-[#767b74]">{plan.period}</span>}
              </div>
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
                    plan.highlight ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {loading === plan.cta ? '処理中...' : plan.ctaLabel}
                </button>
              ) : (
                <Link
                  href="/login?redirect=/pricing"
                  className={`block text-center w-full py-2.5 rounded-xl text-sm font-semibold ${
                    plan.highlight ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {plan.ctaLabel}
                </Link>
              )
            ) : (
              <Link href="/login" className="block text-center btn-secondary w-full py-2.5 rounded-xl text-sm font-semibold">
                {plan.ctaLabel}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg font-bold text-[#111111] mb-5 text-center">よくある質問</h2>
        <div className="space-y-3">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="glass rounded-xl p-5">
              <p className="font-semibold text-sm text-[#111111] mb-1.5">{q}</p>
              <p className="text-sm text-[#5e625c] leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
