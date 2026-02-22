import { createServiceClient } from '@/lib/supabase'
import type { LPWithAnalysis } from '@/types'
import { Header } from '@/components/public/header'
import { LPCard } from '@/components/public/lp-card'
import { GalleryFilters } from '@/components/public/gallery-filters'
import Link from 'next/link'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

interface SearchParams {
  industry?: string
  purpose?: string
  sort?: string
}

async function getLPs(searchParams: SearchParams): Promise<LPWithAnalysis[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('lps')
    .select('*, lp_analyses(*)')
    .eq('status', 'active')

  if (searchParams.industry) {
    query = query.eq('industry', searchParams.industry)
  }
  if (searchParams.purpose) {
    query = query.eq('purpose', searchParams.purpose)
  }

  query = query.limit(20).order('created_at', { ascending: false })

  const { data } = await query
  let lps = (data as LPWithAnalysis[]) ?? []

  if (searchParams.sort === 'score') {
    lps = lps.sort((a, b) => {
      const scoreA = a.lp_analyses?.[0]?.total_score ?? 0
      const scoreB = b.lp_analyses?.[0]?.total_score ?? 0
      return scoreB - scoreA
    })
  }

  return lps
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const lps = await getLPs(searchParams)
  const hasFilters = !!(searchParams.industry || searchParams.purpose)

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 60%), #07070f',
      }}
    >
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヒーロー */}
        <div className="pt-16 pb-12 text-center">
          {/* バッジ */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6"
            style={{
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#818cf8' }}
            />
            <span className="text-xs font-semibold" style={{ color: '#818cf8' }}>
              AIキュレーション LP ギャラリー
            </span>
          </div>

          {/* 見出し */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-5 tracking-tight leading-[1.1]">
            成果の出るLPを、
            <br />
            <span className="text-gradient">AIの根拠</span>で選ぶ。
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-lg mx-auto mb-10 leading-relaxed">
            構造・コピー・信頼・稼働の4軸スコアで評価されたランディングページ。
            「なんとなく良さそう」から根拠ある参考へ。
          </p>

          {/* ステータスカード */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {[
              { value: '4軸', label: 'AI評価スコア' },
              { value: '無料', label: '閲覧できる' },
              { value: '最新', label: '順で更新' },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-5 py-3 rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <span className="text-xl font-black text-white">{value}</span>
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* フィルター */}
        <Suspense>
          <GalleryFilters currentParams={searchParams} />
        </Suspense>

        {/* ギャラリー */}
        {lps.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <>
            <p className="text-xs text-slate-600 mb-4">{lps.length}件表示</p>
            <BentoGrid lps={lps} />
          </>
        )}
      </main>

      {/* フッター */}
      <footer
        className="mt-20 py-8"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <span
              className="font-bold text-sm"
              style={{
                background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              CreVis
            </span>
            <div className="flex gap-5 text-sm text-slate-600">
              <a href="/newsletter" className="hover:text-slate-400 transition-colors">
                ニュースレター
              </a>
              <a href="mailto:info@crevis.jp" className="hover:text-slate-400 transition-colors">
                お問い合わせ
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function BentoGrid({ lps }: { lps: LPWithAnalysis[] }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-16"
      style={{ gridAutoRows: '260px' }}
    >
      {lps.map((lp, index) => {
        const isFeatured = index === 0 && lps.length > 2
        return (
          <div
            key={lp.id}
            className={isFeatured ? 'sm:col-span-2 sm:row-span-2' : ''}
          >
            <LPCard lp={lp} featured={isFeatured} priority={index < 4} />
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-24 pb-32">
      <div
        className="mx-auto w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <svg
          className="w-9 h-9 text-slate-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </div>
      <p className="text-base font-semibold text-slate-400 mb-1.5">
        {hasFilters ? '条件に合うLPが見つかりません' : 'まだLPが登録されていません'}
      </p>
      <p className="text-sm text-slate-600 mb-6">
        {hasFilters ? '別のフィルターを試してみてください' : 'しばらくお待ちください'}
      </p>
      {hasFilters && (
        <Link
          href="/"
          className="text-sm font-medium transition-colors"
          style={{ color: '#818cf8' }}
        >
          ← フィルターをクリアして全件表示
        </Link>
      )}
    </div>
  )
}
