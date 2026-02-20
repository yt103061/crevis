import { createServiceClient } from '@/lib/supabase'
import type { LPWithAnalysis } from '@/types'
import { Header } from '@/components/public/header'
import { LPCard } from '@/components/public/lp-card'
import { GalleryFilters } from '@/components/public/gallery-filters'

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

  if (searchParams.sort === 'score') {
    // スコア順はアプリ側でソート
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* ヒーロー */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              成果の出るLPを、<span className="text-indigo-600">AIの根拠</span>で選ぶ
            </h1>
            <p className="text-base text-gray-500">
              構造・コピー・信頼・稼働スコアで評価されたランディングページのキュレーションギャラリー。
              「なんとなく良さそう」から「根拠ある選択」へ。
            </p>
          </div>
        </div>
      </div>

      {/* フィルター + ギャラリー */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GalleryFilters currentParams={searchParams} />

        {lps.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-2">LPが見つかりません</p>
            <p className="text-sm">フィルターを変更してみてください</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-4">{lps.length}件表示</p>
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
