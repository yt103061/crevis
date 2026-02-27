import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { getAuthUser, getUserPlan, canAccessFullLP } from '@/lib/auth'
import { getMonthlyViewCount, recordView, FREE_VIEW_LIMIT } from '@/lib/view-limit'
import type { LPWithAnalysis } from '@/types'
import { Header } from '@/components/public/header'
import { Badge } from '@/components/ui/badge'
import { RadarChart } from '@/components/public/radar-chart'
import { CollectionButton } from '@/components/public/collection-button'

export const dynamic = 'force-dynamic'

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

function scoreColor(score: number) {
  if (score >= 80) return { text: '#16a34a', bg: 'rgba(22,163,74,0.08)', ring: '#16a34a' }
  if (score >= 60) return { text: '#ca8a04', bg: 'rgba(202,138,4,0.08)', ring: '#ca8a04' }
  return { text: '#dc2626', bg: 'rgba(220,38,38,0.08)', ring: '#dc2626' }
}

export default async function LPDetailPage({ params }: Props) {
  const [lp, user] = await Promise.all([getLP(params.id), getAuthUser()])

  if (!lp) notFound()

  const analysis = lp.lp_analyses?.[0]

  // プラン判定
  const plan = user ? await getUserPlan(user.id) : 'free'
  const isPro = canAccessFullLP(plan)
  const isLoggedIn = !!user

  // LP閲覧制限チェック（未ログインは制限なし、Proは制限なし）
  let viewAllowed = true
  let monthlyCount = 0
  let remaining = FREE_VIEW_LIMIT

  if (user && !isPro) {
    monthlyCount = await getMonthlyViewCount(user.id)
    viewAllowed = monthlyCount < FREE_VIEW_LIMIT
    remaining = Math.max(0, FREE_VIEW_LIMIT - monthlyCount)
    if (viewAllowed) {
      // 閲覧記録（非同期で実行、待機不要）
      recordView(user.id, lp.id).catch(console.error)
    }
  }

  // コレクション状態
  let isCollected = false
  if (user) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', user.id)
      .eq('lp_id', lp.id)
      .single()
    isCollected = !!data
  }

  const totalColor = analysis ? scoreColor(analysis.total_score) : null

  // 閲覧上限に達した場合のウォール
  if (!viewAllowed) {
    return (
      <div className="min-h-screen bg-[#f7f7f5]">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="glass rounded-2xl p-10">
            <div className="w-16 h-16 rounded-2xl bg-[#eef2ff] flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-[#1d4ed8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#111111] mb-3">今月の無料閲覧上限に達しました</h2>
            <p className="text-sm text-[#5e625c] mb-2">
              今月は {FREE_VIEW_LIMIT} 件のLPを閲覧しました。
            </p>
            <p className="text-sm text-[#5e625c] mb-8">
              Proプランにアップグレードすると、LPを無制限に閲覧できます。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/pricing" className="btn-primary">
                Proプランを見る
              </Link>
              <Link href="/" className="btn-secondary">
                ギャラリーに戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Breadcrumb + 残り閲覧数バッジ */}
        <nav className="flex items-center justify-between gap-2 mb-6 animate-fade-in flex-wrap">
          <div className="flex items-center gap-2 text-sm text-[#767b74]">
            <Link href="/" className="hover:text-[#111111] transition-colors">ギャラリー</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[#5e625c] truncate max-w-[200px]">{lp.title ?? 'LP詳細'}</span>
          </div>
          {user && !isPro && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              remaining <= 5
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-[#f1f1ee] text-[#5e625c] border border-[#d9dbd6]'
            }`}>
              今月の残り閲覧: {remaining}件
            </span>
          )}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Screenshot + AI Comments */}
          <div className="lg:col-span-2 space-y-5">
            {/* Screenshot */}
            <div className="glass rounded-2xl overflow-hidden animate-fade-in-up">
              {lp.screenshot_url ? (
                <div className="relative max-w-[800px] mx-auto w-full">
                  <Image
                    src={lp.screenshot_url}
                    alt={lp.title ?? lp.url}
                    width={1280}
                    height={900}
                    className="w-full h-auto"
                    priority
                    placeholder="blur"
                    blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                  />
                </div>
              ) : (
                <div className="aspect-[16/9] flex flex-col items-center justify-center gap-3 bg-[#f1f1ee]">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center shimmer">
                    <svg className="w-8 h-8 text-[#8a8f88]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs text-[#767b74]">スクリーンショット取得中...</span>
                </div>
              )}
            </div>

            {/* AI Comments */}
            {analysis && (
              <div className="glass rounded-2xl p-5 sm:p-6 space-y-5 animate-fade-in-up stagger-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(29,78,216,0.08)' }}>
                    <svg className="w-4 h-4 text-[#1d4ed8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h2 className="font-bold text-[#111111]">AI分析コメント</h2>
                </div>

                {/* Good Points — 全プランで表示 */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 mb-3">
                    <span className="w-5 h-5 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(22,163,74,0.1)' }}>✓</span>
                    良い点
                  </h3>
                  <ul className="space-y-2">
                    {analysis.good_points.map((point, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-[#323632] pl-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600/60 mt-1.5 shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Improvement Points — Pro のみ全文 */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-700 mb-3">
                    <span className="w-5 h-5 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(202,138,4,0.1)' }}>▲</span>
                    改善点
                  </h3>
                  <div className={!isPro ? 'relative' : ''}>
                    <ul className={`space-y-2 ${!isPro ? 'blur-sm select-none pointer-events-none' : ''}`}>
                      {analysis.improvement_points.map((point, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-[#323632] pl-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600/60 mt-1.5 shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                    {!isPro && <BlurOverlay isLoggedIn={isLoggedIn} />}
                  </div>
                </div>

                {/* Why it works — Pro のみ全文 */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[#1d4ed8] mb-3">
                    <span className="w-5 h-5 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(29,78,216,0.08)' }}>★</span>
                    なぜ成果が出るのか
                  </h3>
                  <div className={!isPro ? 'relative' : ''}>
                    <p className={`text-sm text-[#323632] leading-relaxed ${!isPro ? 'blur-sm select-none pointer-events-none' : ''}`}>
                      {analysis.why_it_works}
                    </p>
                    {!isPro && <BlurOverlay isLoggedIn={isLoggedIn} />}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Scores + Meta */}
          <div className="space-y-5">
            {/* Total Score */}
            {analysis && totalColor && (
              <div className="glass rounded-2xl p-5 animate-fade-in-up stagger-1">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-[#111111]">総合スコア</h2>
                  <div
                    className="text-2xl font-black px-4 py-1.5 rounded-xl"
                    style={{ color: totalColor.text, background: totalColor.bg }}
                  >
                    {analysis.total_score}
                  </div>
                </div>

                <RadarChart analysis={analysis} />

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <ScoreItem label="構造" score={analysis.structure_score} />
                  <ScoreItem label="コピー" score={analysis.copy_score} />
                  <ScoreItem label="信頼" score={analysis.trust_score} />
                  <ScoreItem label="稼働" score={analysis.longevity_score} />
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="glass rounded-2xl p-5 space-y-4 animate-fade-in-up stagger-2">
              <h2 className="font-bold text-[#111111]">LP情報</h2>
              <div className="flex flex-wrap gap-2">
                {lp.industry && <Badge variant="outline">{lp.industry}</Badge>}
                {lp.purpose && <Badge variant="default">{lp.purpose}</Badge>}
                {lp.ad_platform && <Badge variant="warning">{lp.ad_platform}</Badge>}
              </div>
              {lp.target_audience && (
                <div>
                  <p className="text-xs text-[#767b74] mb-1">ターゲット</p>
                  <p className="text-sm text-[#323632]">{lp.target_audience}</p>
                </div>
              )}
              {analysis?.target_match && (
                <div>
                  <p className="text-xs text-[#767b74] mb-1">ターゲット一致分析</p>
                  <div className={!isPro ? 'relative' : ''}>
                    <p className={`text-sm text-[#323632] ${!isPro ? 'blur-sm select-none pointer-events-none' : ''}`}>
                      {analysis.target_match}
                    </p>
                    {!isPro && <BlurOverlay small isLoggedIn={isLoggedIn} />}
                  </div>
                </div>
              )}
              <div className="pt-3 border-t border-[#d9dbd6]">
                <a
                  href={lp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[#1d4ed8] hover:opacity-80 font-medium transition-opacity"
                >
                  元のLPを見る
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Effectiveness Score */}
            {lp.effectiveness_score !== null && lp.effectiveness_score !== undefined && (
              <div className="glass rounded-2xl p-5 space-y-4 animate-fade-in-up stagger-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-[#111111]">効果推定スコア</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-[#111111]">{lp.effectiveness_score}</span>
                    <span className="text-sm text-[#767b74]">/ 100</span>
                    {lp.effectiveness_grade && (
                      <span className={`ml-1 px-2 py-0.5 rounded text-sm font-bold ${
                        lp.effectiveness_grade === 'S' ? 'bg-amber-400 text-white' :
                        lp.effectiveness_grade === 'A' ? 'bg-[#1d4ed8] text-white' :
                        lp.effectiveness_grade === 'B' ? 'bg-[#767b74] text-white' :
                        'bg-[#e3e5e0] text-[#5e625c]'
                      }`}>
                        {lp.effectiveness_grade}
                      </span>
                    )}
                  </div>
                </div>

                {/* 内訳 */}
                <div className="space-y-2">
                  {lp.longevity_score !== null && lp.longevity_score !== undefined && (
                    <ScoreBarItem
                      label="運用実績"
                      score={lp.longevity_score}
                      note="Wayback Machine による生存期間"
                    />
                  )}
                  {lp.cro_score !== null && lp.cro_score !== undefined && (
                    <ScoreBarItem
                      label="CRO適合度"
                      score={lp.cro_score}
                      note="CROベストプラクティスへの適合"
                    />
                  )}
                  {analysis && (
                    <ScoreBarItem
                      label="AI総合評価"
                      score={Math.round((analysis.structure_score + analysis.copy_score + analysis.trust_score + analysis.longevity_score) / 4)}
                      note="構造・コピー・信頼・稼働の平均"
                    />
                  )}
                </div>

                <p className="text-xs text-[#8a8f88] leading-relaxed pt-1 border-t border-[#d9dbd6]">
                  このスコアはLPの運用期間、CROベストプラクティスへの適合度、AI分析を組み合わせて算出した、成果の蓋然性を示す独自指標です。
                </p>
              </div>
            )}

            {/* Collection */}
            <div className="animate-fade-in-up stagger-3">
              <CollectionButton lpId={lp.id} isCollected={isCollected} isLoggedIn={isLoggedIn} />
            </div>

            {/* Takedown */}
            <div className="text-center animate-fade-in stagger-4">
              <a
                href={`mailto:info@crevis.jp?subject=削除申請: ${lp.id}`}
                className="text-xs text-[#8a8f88] hover:text-[#5e625c] transition-colors"
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

function ScoreBarItem({ label, score, note }: { label: string; score: number; note?: string }) {
  const color = scoreColor(score)
  const pct = Math.max(0, Math.min(100, score))

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-xs font-medium text-[#323632]">{label}</span>
          {note && <span className="text-[10px] text-[#8a8f88] ml-1.5">{note}</span>}
        </div>
        <span className="text-sm font-bold" style={{ color: color.text }}>{score}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-[#e3e5e0]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color.ring }}
        />
      </div>
    </div>
  )
}

function ScoreItem({ label, score }: { label: string; score: number }) {
  const color = scoreColor(score)
  const pct = Math.max(0, Math.min(100, score))

  return (
    <div className="rounded-xl p-3 bg-[#fafaf8] border border-[#e3e5e0]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#767b74]">{label}</span>
        <span className="text-sm font-bold" style={{ color: color.text }}>{score}</span>
      </div>
      <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: color.ring }}
        />
      </div>
    </div>
  )
}

function BlurOverlay({ small = false, isLoggedIn = false }: { small?: boolean; isLoggedIn?: boolean }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${small ? '' : 'min-h-[60px]'}`}>
      <Link
        href={isLoggedIn ? '/pricing' : '/login'}
        className="btn-primary text-xs flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        {isLoggedIn ? 'Proプランで全文を見る' : 'ログインして全文を見る'}
      </Link>
    </div>
  )
}
