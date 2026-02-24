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

async function getLPCount(): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await supabase
    .from('lps')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  return count ?? 0
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const [lps, totalCount] = await Promise.all([getLPs(searchParams), getLPCount()])
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
        {/* Hero */}
        <div className="pt-12 sm:pt-16 pb-10 sm:pb-12 text-center">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6 animate-fade-in-up"
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
              AI分析 LP ギャラリー
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white mb-5 tracking-tight leading-[1.1] animate-fade-in-up stagger-1">
            成果の出るLPを、
            <br />
            <span className="text-gradient">AIの根拠</span>で選ぶ。
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto mb-8 leading-relaxed animate-fade-in-up stagger-2">
            構造・コピー・信頼・稼働の4軸スコアで評価。
            <br className="hidden sm:block" />
            「なんとなく良さそう」から根拠ある参考へ。
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap animate-fade-in-up stagger-3">
            <StatChip icon="chart" value="4軸" label="AI評価" />
            <StatChip icon="zap" value={`${totalCount}`} label="件のLP" />
            <StatChip icon="sparkle" value="無料" label="で閲覧" />
          </div>

          {/* CTA for non-logged-in */}
          <div className="mt-8 flex items-center justify-center gap-3 animate-fade-in-up stagger-4">
            <Link href="/search" className="btn-secondary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              LPを検索
            </Link>
            <Link href="/newsletter" className="btn-secondary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              週刊NL
            </Link>
          </div>
        </div>

        <section className="mb-10">
          <div
            className="rounded-2xl p-5 sm:p-6"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white">迷わない使い方（3ステップ）</h2>
              <span className="text-xs text-slate-500">初見でも2分でキャッチアップ</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  step: '01',
                  title: '業界・目的で絞り込む',
                  body: 'まずは自社に近い業界と目的で候補を絞ります。',
                },
                {
                  step: '02',
                  title: '4軸スコアを比較する',
                  body: '構造・コピー・信頼・稼働を横並びで評価します。',
                },
                {
                  step: '03',
                  title: '参考LPを保存して運用へ',
                  body: '気になったLPをブックマークして改善案の土台に。',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <p className="text-xs font-bold mb-2" style={{ color: '#818cf8' }}>
                    STEP {item.step}
                  </p>
                  <p className="text-sm font-semibold text-white mb-1.5">{item.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Filters */}
        <Suspense>
          <GalleryFilters currentParams={searchParams} />
        </Suspense>

        {/* Gallery */}
        {lps.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500">{lps.length}件表示</p>
              {hasFilters && (
                <Link href="/" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  フィルターをクリア
                </Link>
              )}
            </div>
            <BentoGrid lps={lps} />
          </>
        )}
      </main>

      {/* Footer */}
      <footer
        className="mt-20 py-10"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                C
              </div>
              <span className="font-bold text-sm text-slate-400">CreVis</span>
              <span className="text-xs text-slate-600 ml-2">成果の出るLPギャラリー</span>
            </div>
            <div className="flex gap-6 text-sm text-slate-500">
              <Link href="/newsletter" className="hover:text-slate-300 transition-colors">
                ニュースレター
              </Link>
              <Link href="/search" className="hover:text-slate-300 transition-colors">
                検索
              </Link>
              <a href="mailto:info@crevis.jp" className="hover:text-slate-300 transition-colors">
                お問い合わせ
              </a>
            </div>
          </div>
          <p className="text-center text-xs text-slate-700 mt-6">
            &copy; 2026 CreVis. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

function StatChip({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <span className="text-indigo-400">
        {icon === 'chart' && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )}
        {icon === 'zap' && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
        {icon === 'sparkle' && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-base font-black text-white">{value}</span>
        <span className="text-[11px] text-slate-500">{label}</span>
      </div>
    </div>
  )
}

function BentoGrid({ lps }: { lps: LPWithAnalysis[] }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-16"
      style={{ gridAutoRows: '280px' }}
    >
      {lps.map((lp, index) => {
        const isFeatured = index === 0 && lps.length > 2
        return (
          <div
            key={lp.id}
            className={`animate-fade-in-up ${isFeatured ? 'sm:col-span-2 sm:row-span-2' : ''}`}
            style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
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
    <div className="text-center py-20 pb-28 animate-fade-in-up">
      <div
        className="mx-auto w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
        style={{
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.15)',
        }}
      >
        {hasFilters ? (
          <svg className="w-10 h-10 text-indigo-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        ) : (
          <svg className="w-10 h-10 text-indigo-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        )}
      </div>
      <p className="text-lg font-semibold text-slate-300 mb-2">
        {hasFilters ? '条件に合うLPが見つかりません' : 'LPを準備しています'}
      </p>
      <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto">
        {hasFilters
          ? '別のフィルターを試すか、すべてのLPを表示してみてください'
          : 'AIが分析したLPがまもなく追加されます。ニュースレターに登録すると新着をお知らせします'}
      </p>
      <div className="flex items-center justify-center gap-3">
        {hasFilters ? (
          <Link href="/" className="btn-primary">
            すべてのLPを表示
          </Link>
        ) : (
          <Link href="/newsletter" className="btn-primary">
            ニュースレターに登録
          </Link>
        )}
      </div>
    </div>
  )
}
