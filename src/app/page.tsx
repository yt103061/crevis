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

  query = query.limit(20)
  query = query.order('created_at', { ascending: false })

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
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* ヒーロー */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                成果の出るLPを、<span className="text-indigo-600">AIの根拠</span>で選ぶ
              </h1>
              <p className="text-base text-gray-500">
                構造・コピー・信頼・稼働の4軸でAIが評価したLPキュレーションギャラリー。
                「なんとなく良さそう」から「根拠ある参考」へ。
              </p>
            </div>
            <div className="flex gap-8 shrink-0">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">4軸</p>
                <p className="text-xs text-gray-400 mt-0.5">AI評価スコア</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">無料</p>
                <p className="text-xs text-gray-400 mt-0.5">で閲覧できる</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* フィルター + ギャラリー */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense>
          <GalleryFilters currentParams={searchParams} />
        </Suspense>

        {lps.length === 0 ? (
          <div className="text-center py-20">
            <div className="mx-auto w-20 h-20 bg-white rounded-2xl border border-gray-200 flex items-center justify-center mb-5 shadow-sm">
              <svg className="w-9 h-9 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">
              {hasFilters ? '条件に合うLPが見つかりません' : 'まだLPが登録されていません'}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              {hasFilters ? '別のフィルターを試してみてください' : 'しばらくお待ちください'}
            </p>
            {hasFilters && (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                ← フィルターをクリアして全件表示
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">{lps.length}件表示</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {lps.map((lp) => (
                <LPCard key={lp.id} lp={lp} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* フッター */}
      <footer className="border-t border-gray-200 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-600">CreVis</span>
            <div className="flex gap-4 text-sm text-gray-500">
              <a href="/newsletter" className="hover:text-gray-700">ニュースレター</a>
              <a href="mailto:info@crevis.jp" className="hover:text-gray-700">お問い合わせ</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
