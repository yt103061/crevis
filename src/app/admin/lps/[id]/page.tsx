'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { LPWithAnalysis } from '@/types'
import { formatDate, scoreBg } from '@/lib/utils'

interface LPPageFeatures {
  h1_text: string | null
  h2_texts: string[] | null
  meta_title: string | null
  meta_description: string | null
  main_copy_snippets: string[] | null
  cta_buttons: string[] | null
  form_field_count: number | null
  has_main_form: boolean | null
  total_sections: number | null
  nav_link_count: number | null
  external_link_count: number | null
  total_image_count: number | null
  has_video: boolean | null
  has_social_proof: boolean | null
  has_testimonials: boolean | null
  has_faq: boolean | null
  has_pricing: boolean | null
  has_no_index: boolean | null
  page_load_time_ms: number | null
  page_height_ratio: number | null
  lp_confidence_score: number | null
  is_likely_lp: boolean | null
}

const statusStyle: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-[#f1f1ee] text-[#5e625c]',
  takedown: 'bg-rose-50 text-rose-700',
}
const statusLabel: Record<string, string> = {
  active: '公開中',
  archived: 'アーカイブ',
  takedown: '削除申請',
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#5e625c]">{label}</span>
        <span className={`font-semibold px-1.5 rounded ${scoreBg(score)}`}>{score}</span>
      </div>
      <div className="h-1.5 bg-[#e3e5e0] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

function Chip({ on, label }: { on: boolean | null; label: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f1f1ee] text-[#8a8f88]'}`}>
      {on ? '✓' : '✗'} {label}
    </span>
  )
}

export default function LPDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [lp, setLp] = useState<LPWithAnalysis | null>(null)
  const [features, setFeatures] = useState<LPPageFeatures | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reanalyzing, setReanalyzing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadLP()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadLP() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/lps/${id}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `エラー ${res.status}`)
      } else {
        setLp(data.lp)
        setFeatures(data.features ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(status: string) {
    const res = await fetch(`/api/admin/lps/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) loadLP()
    else alert('ステータスの更新に失敗しました')
  }

  async function reanalyze() {
    setReanalyzing(true)
    const res = await fetch(`/api/admin/lps/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reanalyze' }),
    })
    setReanalyzing(false)
    if (res.ok) {
      loadLP()
    } else {
      alert('再分析に失敗しました')
    }
  }

  async function deleteLp() {
    if (!lp || !confirm(`「${lp.title ?? 'このLP'}」を完全に削除しますか？`)) return
    setDeleting(true)
    const res = await fetch(`/api/admin/lps/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      router.push('/admin/lps')
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? '削除に失敗しました')
    }
  }

  if (loading) return <div className="py-16 text-center text-[#8a8f88] text-sm">読み込み中...</div>
  if (error) return (
    <div className="py-8">
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 mb-4">{error}</div>
      <Link href="/admin/lps" className="text-sm text-[#1d4ed8] hover:underline">← LP一覧に戻る</Link>
    </div>
  )
  if (!lp) return null

  const analysis = lp.lp_analyses?.[0]

  return (
    <div className="max-w-3xl">
      {/* パンくず */}
      <nav className="flex items-center gap-2 text-xs text-[#767b74] mb-4">
        <Link href="/admin/lps" className="hover:text-[#111111]">LP一覧</Link>
        <span>/</span>
        <span className="text-[#111111] truncate max-w-xs">{lp.title ?? lp.url}</span>
      </nav>

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[lp.status] ?? ''}`}>
              {statusLabel[lp.status] ?? lp.status}
            </span>
            {lp.industry && (
              <span className="text-xs bg-[#f1f1ee] text-[#5e625c] px-2 py-0.5 rounded">{lp.industry}</span>
            )}
            {lp.lp_confidence_score != null && (
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${lp.is_likely_lp ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                LP判定スコア: {lp.lp_confidence_score}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-[#111111]">{lp.title ?? '(タイトルなし)'}</h1>
          <a
            href={lp.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#1d4ed8] hover:underline mt-0.5 block"
          >
            {lp.url} →
          </a>
          <p className="text-xs text-[#767b74] mt-1">登録日: {formatDate(lp.created_at)}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={reanalyze}
            disabled={reanalyzing}
            className="px-3 py-2 text-sm bg-[#111111] text-white rounded-lg hover:bg-[#2a2a2a] disabled:opacity-50 font-medium"
          >
            {reanalyzing ? '分析中...' : '再分析'}
          </button>
          {lp.status === 'active' && (
            <button onClick={() => updateStatus('archived')} className="px-3 py-2 text-sm border border-[#d9dbd6] text-[#5e625c] rounded-lg hover:bg-[#f1f1ee]">
              アーカイブ
            </button>
          )}
          {lp.status === 'archived' && (
            <button onClick={() => updateStatus('active')} className="px-3 py-2 text-sm border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50">
              公開に戻す
            </button>
          )}
          <button
            onClick={deleteLp}
            disabled={deleting}
            className="px-3 py-2 text-sm border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 disabled:opacity-50"
          >
            {deleting ? '削除中...' : '削除'}
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {/* スクリーンショット */}
        {lp.screenshot_url && (
          <section className="bg-white rounded-xl border border-[#d9dbd6] overflow-hidden">
            <div className="p-3 border-b border-[#e3e5e0]">
              <h2 className="text-sm font-semibold text-[#111111]">スクリーンショット</h2>
            </div>
            <a href={lp.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lp.screenshot_url}
                alt={lp.title ?? 'LP screenshot'}
                className="w-full object-cover max-h-96 hover:opacity-90 transition-opacity"
              />
            </a>
          </section>
        )}

        {/* AI分析スコア */}
        {analysis ? (
          <section className="bg-white rounded-xl border border-[#d9dbd6] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#111111]">AI分析スコア</h2>
              <span className={`text-lg font-bold px-3 py-1 rounded-lg ${scoreBg(analysis.total_score)}`}>
                {analysis.total_score} / 100
              </span>
            </div>
            <div className="space-y-3 mb-5">
              <ScoreBar label="構造スコア" score={analysis.structure_score} />
              <ScoreBar label="コピースコア" score={analysis.copy_score} />
              <ScoreBar label="信頼スコア" score={analysis.trust_score} />
              <ScoreBar label="継続性スコア" score={analysis.longevity_score} />
            </div>

            <div className="space-y-4 border-t border-[#e3e5e0] pt-4">
              {analysis.why_it_works && (
                <div>
                  <p className="text-xs font-semibold text-[#5e625c] mb-1">効果的な理由</p>
                  <p className="text-sm text-[#111111] leading-relaxed">{analysis.why_it_works}</p>
                </div>
              )}
              {analysis.target_match && (
                <div>
                  <p className="text-xs font-semibold text-[#5e625c] mb-1">ターゲット適合度</p>
                  <p className="text-sm text-[#111111] leading-relaxed">{analysis.target_match}</p>
                </div>
              )}
              {analysis.good_points?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-1.5">強み</p>
                  <ul className="space-y-1">
                    {analysis.good_points.map((pt: string, i: number) => (
                      <li key={i} className="text-sm text-[#111111] flex items-start gap-1.5">
                        <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.improvement_points?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">改善点</p>
                  <ul className="space-y-1">
                    {analysis.improvement_points.map((pt: string, i: number) => (
                      <li key={i} className="text-sm text-[#111111] flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5 shrink-0">→</span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="bg-white rounded-xl border border-[#d9dbd6] p-5 text-center">
            <p className="text-sm text-[#8a8f88] mb-3">AI分析が未実行です</p>
            <button
              onClick={reanalyze}
              disabled={reanalyzing}
              className="px-4 py-2 bg-[#111111] text-white text-sm rounded-lg hover:bg-[#2a2a2a] disabled:opacity-50"
            >
              {reanalyzing ? '分析中...' : '今すぐ分析する'}
            </button>
          </section>
        )}

        {/* ページ構造情報 */}
        {features && (
          <section className="bg-white rounded-xl border border-[#d9dbd6] p-5">
            <h2 className="text-sm font-semibold text-[#111111] mb-4">ページ構造データ</h2>

            {features.h1_text && (
              <div className="mb-3">
                <p className="text-xs text-[#5e625c] font-medium mb-0.5">H1見出し</p>
                <p className="text-sm text-[#111111] font-medium">{features.h1_text}</p>
              </div>
            )}

            {features.meta_description && (
              <div className="mb-3">
                <p className="text-xs text-[#5e625c] font-medium mb-0.5">メタ説明</p>
                <p className="text-sm text-[#767b74]">{features.meta_description}</p>
              </div>
            )}

            {features.cta_buttons && features.cta_buttons.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-[#5e625c] font-medium mb-1.5">CTAボタン</p>
                <div className="flex flex-wrap gap-1.5">
                  {features.cta_buttons.map((btn, i) => (
                    <span key={i} className="text-xs bg-[#111111] text-white px-2 py-0.5 rounded font-medium">
                      {btn}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {features.h2_texts && features.h2_texts.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-[#5e625c] font-medium mb-1.5">H2見出し一覧</p>
                <ul className="space-y-0.5">
                  {features.h2_texts.map((h2, i) => (
                    <li key={i} className="text-sm text-[#767b74] flex items-start gap-1.5">
                      <span className="text-[#8a8f88] shrink-0">—</span>{h2}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 数値サマリー */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 border-t border-[#e3e5e0] pt-4">
              {[
                { label: 'セクション数', value: features.total_sections },
                { label: 'ナビリンク', value: features.nav_link_count },
                { label: '外部リンク', value: features.external_link_count },
                { label: '画像数', value: features.total_image_count },
                { label: 'フォームフィールド', value: features.form_field_count },
                { label: '表示時間(ms)', value: features.page_load_time_ms },
              ].map(({ label, value }) =>
                value != null ? (
                  <div key={label} className="bg-[#f7f7f5] rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-[#111111]">{value}</p>
                    <p className="text-xs text-[#767b74]">{label}</p>
                  </div>
                ) : null
              )}
            </div>

            {/* 信頼要素チェック */}
            <div>
              <p className="text-xs text-[#5e625c] font-medium mb-2">ページ要素チェック</p>
              <div className="flex flex-wrap gap-2">
                <Chip on={features.has_main_form} label="メインフォーム" />
                <Chip on={features.has_social_proof} label="社会的証明" />
                <Chip on={features.has_testimonials} label="お客様の声" />
                <Chip on={features.has_faq} label="FAQ" />
                <Chip on={features.has_pricing} label="料金プラン" />
                <Chip on={features.has_video} label="動画" />
                <Chip on={features.has_no_index} label="noindex" />
              </div>
            </div>
          </section>
        )}

        {/* 基本情報 */}
        <section className="bg-white rounded-xl border border-[#d9dbd6] p-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-3">基本情報</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[
              { label: '業界', value: lp.industry },
              { label: '目的', value: lp.purpose },
              { label: 'ターゲット', value: lp.target_audience },
              { label: '広告プラットフォーム', value: lp.ad_platform },
              { label: '最終確認日', value: lp.last_checked_at ? formatDate(lp.last_checked_at) : null },
            ].map(({ label, value }) =>
              value ? (
                <div key={label}>
                  <dt className="text-xs text-[#8a8f88]">{label}</dt>
                  <dd className="text-[#111111] mt-0.5">{value}</dd>
                </div>
              ) : null
            )}
          </dl>
        </section>
      </div>
    </div>
  )
}
