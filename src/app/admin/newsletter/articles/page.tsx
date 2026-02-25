'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { NLArticle } from '@/types'
import { formatDate } from '@/lib/utils'

export default function NLArticlesPage() {
  const [articles, setArticles] = useState<NLArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [bulkApproving, setBulkApproving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('pending')

  useEffect(() => {
    fetchArticles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  async function fetchArticles() {
    setLoading(true)
    let query = supabase
      .from('nl_articles')
      .select('*')
      .order('relevance_score', { ascending: false })

    if (statusFilter) query = query.eq('status', statusFilter)

    const { data } = await query.limit(100)
    setArticles((data as NLArticle[]) ?? [])
    setLoading(false)
  }

  async function fetchFromSources() {
    setFetching(true)
    const res = await fetch('/api/admin/nl/fetch', { method: 'POST' })
    const data = await res.json()
    setFetching(false)
    if (res.ok) {
      alert(`収集完了: ${data.results.processed}件追加, ${data.results.skipped}件スキップ, ${data.results.errors}件エラー\nソースエラー: ${data.results.sourceErrors ?? 0}件 / AIフォールバック: ${data.results.aiFallbacks ?? 0}件`)
      fetchArticles()
    } else {
      alert(data.error ?? '収集に失敗しました')
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
    fetchArticles()
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
    fetchArticles()
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
          ① 「記事を収集」でRSSから最新記事を取得　② 内容を確認して「承認」or「却下」（「全件承認」で一括処理も可能）
          <br />③ 承認後は「号管理」ページで「自動化を実行」するとニュースレターに自動組み込みされます。
        </p>
      </div>

      {/* フィルタータブ */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { value: 'pending', label: '未処理' },
          { value: 'approved', label: '承認済み' },
          { value: 'rejected', label: '却下' },
          { value: '', label: '全て' },
        ].map(({ value, label }) => (
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

      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-[#8a8f88] text-sm">読み込み中...</div>
        ) : articles.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[#8a8f88] text-sm mb-3">
              {statusFilter === 'pending' ? '未処理の記事はありません' : '記事がありません'}
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
          articles.map((article) => (
            <div key={article.id} className="bg-white rounded-xl border border-[#d9dbd6] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {article.relevance_score !== null && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        article.relevance_score >= 70 ? 'bg-emerald-50 text-emerald-700' :
                        article.relevance_score >= 50 ? 'bg-amber-50 text-amber-700' :
                        'bg-[#f1f1ee] text-[#5e625c]'
                      }`}>
                        関連度: {article.relevance_score}
                      </span>
                    )}
                    <span className="text-xs text-[#8a8f88]">{formatDate(article.fetched_at)}</span>
                  </div>
                  <h3 className="font-medium text-[#111111] text-sm mb-0.5">
                    {article.translated_title_ja ?? article.original_title}
                  </h3>
                  {article.translated_title_ja && (
                    <p className="text-xs text-[#8a8f88] mb-2">{article.original_title}</p>
                  )}
                  {article.summary_ja && (
                    <p className="text-sm text-[#5e625c] leading-relaxed">{article.summary_ja}</p>
                  )}
                  {article.key_insights && article.key_insights.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {article.key_insights.map((insight, i) => (
                        <li key={i} className="text-xs text-[#767b74] flex items-start gap-1">
                          <span className="text-[#1d4ed8] mt-0.5">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  )}
                  <a
                    href={article.original_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1d4ed8] hover:underline mt-2 block"
                  >
                    元記事を見る →
                  </a>
                </div>
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
                        article.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-[#f1f1ee] text-[#5e625c]'
                      }`}>
                        {article.status === 'approved' ? '承認済み' : '却下'}
                      </span>
                      <button
                        onClick={() => updateStatus(article.id, 'pending')}
                        className="text-xs text-[#767b74] hover:underline"
                      >
                        戻す
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
