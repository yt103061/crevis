import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import type { LPWithAnalysis } from '@/types'
import { Header } from '@/components/public/header'
import { ScoreBadge } from '@/components/ui/score-badge'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'
import { RadarChart } from '@/components/public/radar-chart'
import { CollectionButton } from '@/components/public/collection-button'

interface Props {
  params: { id: string }
}

async function getLP(id: string): Promise<LPWithAnalysis | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('lps')
    .select('*, lp_analyses(*)')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (error || !data) return null
  return data as LPWithAnalysis
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lp = await getLP(params.id)
  if (!lp) return { title: 'Not Found' }

  return {
    title: lp.title ?? lp.url,
    description: `${lp.industry} / ${lp.purpose} のランディングページ分析。AIスコア: ${lp.lp_analyses?.[0]?.total_score ?? '-'}`,
  }
}

export default async function LPDetailPage({ params }: Props) {
  const [lp, session] = await Promise.all([getLP(params.id), getSession()])

  if (!lp) notFound()

  const analysis = lp.lp_analyses?.[0]
  const isPro = session?.user ? true : false // Phase 2でプラン判定

  // コレクション状態確認
  let isCollected = false
  if (session?.user) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('lp_id', lp.id)
      .single()
    isCollected = !!data
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* パンくず */}
        <nav className="text-sm text-gray-500 mb-4">
          <Link href="/" className="hover:text-indigo-600">ギャラリー</Link>
          <span className="mx-2">/</span>
          <span>{lp.title ?? 'LP詳細'}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左: スクリーンショット + メタ情報 */}
          <div className="lg:col-span-2 space-y-6">
            {/* スクリーンショット */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {lp.screenshot_url ? (
                <div className="relative">
                  <Image
                    src={lp.screenshot_url}
                    alt={lp.title ?? lp.url}
                    width={1280}
                    height={900}
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <div className="aspect-[16/9] flex items-center justify-center bg-gray-100 text-gray-300">
                  スクリーンショット取得中...
                </div>
              )}
            </div>

            {/* AIコメント */}
            {analysis && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="font-bold text-gray-900 mb-4">AI分析コメント</h2>

                {/* Good Points */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-green-700 mb-2">良い点</h3>
                  <ul className="space-y-1">
                    {analysis.good_points.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">✓</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Improvement Points - ブラー制御 */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-orange-700 mb-2">改善点</h3>
                  <div className={!isPro && !session ? 'relative' : ''}>
                    <ul className={`space-y-1 ${!isPro && !session ? 'blur-sm select-none' : ''}`}>
                      {analysis.improvement_points.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-orange-400 mt-0.5">△</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                    {!session && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Link
                          href="/login"
                          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-md hover:bg-indigo-700"
                        >
                          ログインして全文を見る
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Why it works - ブラー制御 */}
                <div>
                  <h3 className="text-sm font-semibold text-indigo-700 mb-2">なぜ成果が出るのか</h3>
                  <div className={`relative ${!isPro && !session ? '' : ''}`}>
                    <p className={`text-sm text-gray-700 ${!session ? 'blur-sm select-none' : ''}`}>
                      {analysis.why_it_works}
                    </p>
                    {!session && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Link
                          href="/login"
                          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-md hover:bg-indigo-700"
                        >
                          ログインして全文を見る
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 右: スコア + メタ情報 */}
          <div className="space-y-5">
            {/* スコア */}
            {analysis && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900">総合スコア</h2>
                  <ScoreBadge score={analysis.total_score} size="lg" />
                </div>
                <RadarChart analysis={analysis} />
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <ScoreRow label="構造" score={analysis.structure_score} />
                  <ScoreRow label="コピー" score={analysis.copy_score} />
                  <ScoreRow label="信頼" score={analysis.trust_score} />
                  <ScoreRow label="稼働" score={analysis.longevity_score} />
                </div>
              </div>
            )}

            {/* メタ情報 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-bold text-gray-900">LP情報</h2>
              <div className="flex flex-wrap gap-2">
                {lp.industry && <Badge variant="outline">{lp.industry}</Badge>}
                {lp.purpose && <Badge variant="default">{lp.purpose}</Badge>}
                {lp.ad_platform && <Badge variant="warning">{lp.ad_platform}</Badge>}
              </div>
              {lp.target_audience && (
                <div>
                  <p className="text-xs text-gray-500">ターゲット</p>
                  <p className="text-sm text-gray-700">{lp.target_audience}</p>
                </div>
              )}
              {analysis?.target_match && (
                <div>
                  <p className="text-xs text-gray-500">ターゲット一致分析</p>
                  <p className={`text-sm text-gray-700 ${!session ? 'blur-sm' : ''}`}>
                    {analysis.target_match}
                  </p>
                </div>
              )}
              <div className="pt-2 border-t border-gray-100">
                <a
                  href={lp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  元のLPを見る
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            {/* コレクションボタン */}
            <CollectionButton lpId={lp.id} isCollected={isCollected} isLoggedIn={!!session} />

            {/* 削除申請 */}
            <div className="text-center">
              <a
                href={`mailto:info@crevis.jp?subject=削除申請: ${lp.id}`}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                このLPの削除を申請する
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${
        score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-500'
      }`}>
        {score}
      </span>
    </div>
  )
}
