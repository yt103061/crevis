'use client'

import { useEffect, useState } from 'react'
import type { NLArticle } from '@/types'
import { formatDate } from '@/lib/utils'

const FILTERS = [
  { value: 'pending', label: '未処理' },
  { value: 'approved', label: '承認済み' },
  { value: 'rejected', label: '却下' },
  { value: 'auto_rejected', label: '自動却下' },
  { value: '', label: '全て' },
]

const evidenceLabel: Record<string, string> = {
  high: '根拠◎',
  medium: '根拠○',
  low: '根拠△',
}
const evidenceStyle: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-[#f1f1ee] text-[#5e625c]',
}

export default function NLArticlesPage() {
  const [articles, setArticles] = useState<NLArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [bulkApproving, setBulkApproving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    loadArticles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  async function loadArticles() {
    setLoading(true)
    setFetchError('')
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/admin/nl/articles${params}`)
      const data = await res.json()
      if (!res.ok) {
        setFetchError(data.error ?? `エラー ${res.status}`)
        setArticles([])
      } else {
        setArticles(data.articles ?? [])
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '読み込みに失敗しました')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchFromSources() {
    setFetching(true)
    try {
      const res = await fetch('/api/admin/nl/fetch', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const r = data.results
        alert(
          `収集完了\n` +
          `追加: ${r.processed}件\n` +
          `スキップ: ${r.skipped}件\n` +
          `自動却下: ${r.autoRejected ?? 0}件\n` +
          `AIフォールバック: ${r.aiFallbacks ?? 0}件\n` +
          `ソースエラー: ${r.sourceErrors ?? 0}件${r.source_error_details?.length ? '\n' + r.source_error_details.slice(0, 3).join('\n') : ''}`
        )
        loadArticles()
      } else {
        alert(data.error ?? '収集に失敗しました')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '収集に失敗しました')
    } finally {
      setFetching(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/nl/articles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(`更新に失敗しました: ${data.error ?? res.status}`)
    }
    loadArticles()
  }

  async function bulkApprove() {
    const pending = articles.filter((a) => a.status === 'pending')
    if (pending.length === 0) return
    if (!confirm(`${pending.length}件の未処理記事を全て承認しますか？`)) return

    setBulkApproving(true)
    let successCount = 0
    for (const article of pending) {
      const res = await fetch(`/api/admin/nl/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      if (res.ok) successCount++
    }
    setBulkApproving(false)
    alert(`${successCount}件を承認しました`)
    loadArticles()
  }

  const pendingCount = articles.filter((a) => a.status === 'pending').length

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#111111]">NL記事一覧</h1>
          {!loading && statusFilter === 'pending' && pendingCount > 0 && (
            <p className="text-xs text-[#767b74] mt-0.5">{pendingCount}件の未処理記事があります</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {statusFilter === 'pending' && pendingCount > 0 && (
            <button
              onClick={bulkApprove}
              disabled={bulkApproving}
              className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {bulkApproving ? '承認中...' : `全件承認 (${pendingCount}件)`}
            </button>
          )}
          <button
            onClick={fetchFromSources}
            disabled={fetching}
            className="px-3 py-2 bg-[#111111] text-white text-sm font-medium rounded-lg hover:bg-[#2a2a2a] disabled:opacity-50 transition-colors"
          >
            {fetching ? '収集中...' : '記事を収集'}
          </button>
        </div>
      </div>

      {/* ワークフロー説明 */}
      <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded-xl p-3 mb-4 flex items-start gap-2">
        <svg className="w-4 h-4 text-[#1d4ed8] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-[#1d4ed8] leading-relaxed">
          <strong>記事処理の手順：</strong>
          ① 「記事を収集」でRSSから最新記事を取得　② 内容を確認して「承認」or「却下」（一括承認も可）
          <br />③ 承認後は「号管理」→「自動化を実行」でニュースレターに自動組み込み。「自動却下」タブでAIが除外した記事も確認できます。
        </p>
      </div>

      {/* フィルタータブ */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              statusFilter === value
                ? 'bg-[#111111] text-white'
                : 'bg-white border border-[#d9dbd6] text-[#5e625c] hover:bg-[#f1f1ee]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* エラー */}
      {fetchError && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center justify-between gap-2">
          <span>{fetchError}</span>
          <button onClick={loadArticles} className="text-xs underline shrink-0">再読み込み</button>
        </div>
      )}

      {/* 自動却下の説明 */}
      {statusFilter === 'auto_rejected' && !loading && articles.length > 0 && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          AIが関連度スコアを30未満と判断した記事、またはキーワードフィルターで除外された記事です。
          必要に応じて「未処理に戻す」から再審査できます。
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-[#8a8f88] text-sm">読み込み中...</div>
        ) : articles.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[#8a8f88] text-sm mb-3">
              {statusFilter === 'pending' ? '未処理の記事はありません' :
               statusFilter === 'auto_rejected' ? '自動却下された記事はありません' :
               '記事がありません'}
            </p>
            {statusFilter === 'pending' && (
              <button
                onClick={fetchFromSources}
                disabled={fetching}
                className="px-4 py-2 bg-[#111111] text-white text-sm font-medium rounded-lg hover:bg-[#2a2a2a] disabled:opacity-50"
              >
                記事を収集する
              </button>
            )}
          </div>
        ) : (
          articles.map((article) => {
            const isExpanded = expanded === article.id
            return (
              <div key={article.id} className="bg-white rounded-xl border border-[#d9dbd6]">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* バッジ行 */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {article.relevance_score !== null && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            article.relevance_score >= 70 ? 'bg-emerald-50 text-emerald-700' :
                            article.relevance_score >= 50 ? 'bg-amber-50 text-amber-700' :
                            'bg-[#f1f1ee] text-[#5e625c]'
                          }`}>
                            関連度 {article.relevance_score}
                          </span>
                        )}
                        {article.evidence_level && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${evidenceStyle[article.evidence_level] ?? ''}`}>
                            {evidenceLabel[article.evidence_level] ?? article.evidence_level}
                          </span>
                        )}
                        {article.extraction_method === 'scrape' && (
                          <span className="text-[10px] text-[#8a8f88] bg-[#f1f1ee] px-1.5 py-0.5 rounded">全文取得</span>
                        )}
                        <span className="text-xs text-[#8a8f88]">{formatDate(article.fetched_at)}</span>
                      </div>

                      {/* タイトル */}
                      <h3 className="font-medium text-[#111111] text-sm mb-0.5">
                        {article.translated_title_ja ?? article.original_title}
                      </h3>
                      {article.translated_title_ja && (
                        <p className="text-xs text-[#8a8f88] mb-2">{article.original_title}</p>
                      )}

                      {/* 要約 */}
                      {article.summary_ja && (
                        <p className="text-sm text-[#5e625c] leading-relaxed">{article.summary_ja}</p>
                      )}

                      {/* 展開時の詳細 */}
                      {isExpanded && (
                        <div className="mt-3 space-y-3">
                          {article.key_insights && article.key_insights.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-[#5e625c] mb-1">インサイト</p>
                              <ul className="space-y-0.5">
                                {article.key_insights.map((insight, i) => (
                                  <li key={i} className="text-xs text-[#767b74] flex items-start gap-1">
                                    <span className="text-[#1d4ed8] mt-0.5 shrink-0">•</span>
                                    {insight}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {article.actionable_tips && article.actionable_tips.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-[#5e625c] mb-1">実践Tips</p>
                              <ul className="space-y-0.5">
                                {article.actionable_tips.map((tip, i) => (
                                  <li key={i} className="text-xs text-[#767b74] flex items-start gap-1">
                                    <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {article.content_length != null && (
                            <p className="text-xs text-[#8a8f88]">
                              本文文字数: {article.content_length.toLocaleString()}字
                              {article.extraction_method && ` (${article.extraction_method === 'scrape' ? 'フルテキスト取得' : 'RSSサマリー'})`}
                            </p>
                          )}
                        </div>
                      )}

                      {/* リンク + 展開ボタン */}
                      <div className="flex items-center gap-3 mt-2">
                        <a
                          href={article.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#1d4ed8] hover:underline"
                        >
                          元記事を見る →
                        </a>
                        {(article.key_insights?.length || article.actionable_tips?.length) ? (
                          <button
                            onClick={() => setExpanded(isExpanded ? null : article.id)}
                            className="text-xs text-[#767b74] hover:text-[#111111]"
                          >
                            {isExpanded ? '閉じる ▲' : '詳細を見る ▼'}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* ステータスアクション */}
                    <div className="shrink-0">
                      {article.status === 'pending' ? (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => updateStatus(article.id, 'approved')}
                            className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                          >
                            承認
                          </button>
                          <button
                            onClick={() => updateStatus(article.id, 'rejected')}
                            className="px-3 py-1.5 text-xs bg-white border border-[#d9dbd6] text-[#5e625c] rounded-lg hover:bg-[#f1f1ee]"
                          >
                            却下
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-end">
                          <span className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                            article.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                            article.status === 'auto_rejected' ? 'bg-amber-50 text-amber-700' :
                            'bg-[#f1f1ee] text-[#5e625c]'
                          }`}>
                            {article.status === 'approved' ? '承認済み' :
                             article.status === 'auto_rejected' ? '自動却下' : '却下'}
                          </span>
                          <button
                            onClick={() => updateStatus(article.id, 'pending')}
                            className="text-xs text-[#767b74] hover:underline"
                          >
                            未処理に戻す
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
