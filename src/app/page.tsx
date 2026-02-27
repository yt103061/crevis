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

  let query = supabase.from('lps').select('*, lp_analyses(*)').eq('status', 'active')

  if (searchParams.industry) query = query.eq('industry', searchParams.industry)
  if (searchParams.purpose) query = query.eq('purpose', searchParams.purpose)

  query = query.limit(20).order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) console.error('getLPs query failed:', error.message)
  let lps = (data as LPWithAnalysis[]) ?? []

  if (searchParams.sort === 'score') {
    lps = lps.sort((a, b) => (b.lp_analyses?.[0]?.total_score ?? 0) - (a.lp_analyses?.[0]?.total_score ?? 0))
  }

  return lps
}

async function getLPCount(): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await supabase.from('lps').select('id', { count: 'exact', head: true }).eq('status', 'active')
  return count ?? 0
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const [lps, totalCount] = await Promise.all([getLPs(searchParams), getLPCount()])
  const hasFilters = !!(searchParams.industry || searchParams.purpose)

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <section className="pt-12 sm:pt-16 pb-10 sm:pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6 border border-[#d9dbd6] bg-white">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1d4ed8]" />
            <span className="text-xs font-semibold text-[#1d4ed8]">AI分析 LP ギャラリー</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold text-[#111111] mb-5 tracking-tight leading-[1.1]">
            成果の出るLPを、
            <br />
            根拠で選ぶ。
          </h1>

          <p className="text-sm sm:text-base text-[#5e625c] max-w-lg mx-auto mb-8 leading-relaxed">
            構造・コピー・信頼・稼働の4軸スコアで評価し、
            <br className="hidden sm:block" />
            デザイン判断の根拠を提供します。
          </p>

          <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
            <StatChip value="4軸" label="AI評価" />
            <StatChip value={`${totalCount}`} label="件のLP" />
            <StatChip value="無料" label="で閲覧" />
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/search" className="btn-secondary">LPを検索</Link>
            <Link href="/newsletter" className="btn-secondary">週刊NL</Link>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-[#d9dbd6] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="text-sm sm:text-base font-semibold text-[#111111]">迷わない使い方（3ステップ）</h2>
            <span className="text-xs text-[#767b74]">初見でも2分でキャッチアップ</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { step: '01', title: '業界・目的で絞り込む', body: '自社に近い業界と目的で候補を絞ります。' },
              { step: '02', title: '4軸スコアを比較する', body: '構造・コピー・信頼・稼働を横並びで確認します。' },
              { step: '03', title: '参考LPを保存する', body: '再現性のある改善施策としてストックします。' },
            ].map((item) => (
              <div key={item.step} className="rounded-lg border border-[#e3e5e0] bg-[#fafaf8] p-4">
                <p className="text-[11px] font-semibold text-[#1d4ed8] mb-1">STEP {item.step}</p>
                <p className="text-sm font-medium text-[#111111] mb-1">{item.title}</p>
                <p className="text-xs text-[#6b7068] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-5">
            <Suspense>
              <GalleryFilters />
            </Suspense>

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#767b74]">{lps.length}件表示</p>
              {hasFilters && (
                <Link href="/" className="text-xs text-[#1d4ed8] hover:underline">
                  フィルターをクリア
                </Link>
              )}
            </div>

            {lps.length === 0 ? <EmptyState hasFilters={hasFilters} /> : <BentoGrid lps={lps} />}
          </div>
        </section>
      </main>

      <footer className="mt-20 py-10 border-t border-[#d9dbd6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white bg-[#111111]">C</div>
              <span className="font-semibold text-sm text-[#111111]">CreVis</span>
              <span className="text-xs text-[#8a8f88] ml-2">成果の出るLPギャラリー</span>
            </div>
            <div className="flex gap-6 text-sm text-[#767b74]">
              <Link href="/newsletter" className="hover:text-[#111]">ニュースレター</Link>
              <Link href="/search" className="hover:text-[#111]">検索</Link>
              <a href="mailto:info@crevis.jp" className="hover:text-[#111]">お問い合わせ</a>
            </div>
          </div>
          <p className="text-center text-xs text-[#8a8f88] mt-6">&copy; 2026 CreVis. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 px-4 py-2.5 rounded-lg bg-white border border-[#d9dbd6]">
      <span className="text-base font-semibold text-[#111111] font-num">{value}</span>
      <span className="text-[11px] text-[#767b74]">{label}</span>
    </div>
  )
}

function BentoGrid({ lps }: { lps: LPWithAnalysis[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-16" style={{ gridAutoRows: '280px' }}>
      {lps.map((lp, index) => {
        const isFeatured = index === 0 && lps.length > 2
        return (
          <div key={lp.id} className={isFeatured ? 'sm:col-span-2 sm:row-span-2' : ''}>
            <LPCard lp={lp} featured={isFeatured} priority={index < 4} />
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-20 pb-28 rounded-xl border border-[#d9dbd6] bg-white">
      <p className="text-lg font-medium text-[#323632] mb-2">{hasFilters ? '条件に合うLPが見つかりません' : 'LPを準備しています'}</p>
      <p className="text-sm text-[#767b74] mb-8 max-w-sm mx-auto">
        {hasFilters
          ? '別のフィルターを試すか、すべてのLPを表示してみてください'
          : 'AIが分析したLPがまもなく追加されます。ニュースレターに登録すると新着をお知らせします'}
      </p>
      <div className="flex items-center justify-center gap-3">
        {hasFilters ? (
          <Link href="/" className="btn-primary">すべてのLPを表示</Link>
        ) : (
          <Link href="/newsletter" className="btn-primary">ニュースレターに登録</Link>
        )}
      </div>
    </div>
  )
}
