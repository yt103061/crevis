'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { NLArticle } from '@/types'
import { formatDate } from '@/lib/utils'

export default function NLArticlesPage() {
  const [articles, setArticles] = useState<NLArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
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
      alert(`収集完了: ${data.results.processed}件追加, ${data.results.skipped}件スキップ, ${data.results.errors}件エラー`)
      fetchArticles()
    } else {
      alert(data.error ?? '収集に失敗しました')
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/admin/nl/articles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchArticles()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">NL記事一覧</h1>
        <button
          onClick={fetchFromSources}
          disabled={fetching}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {fetching ? '収集中...' : '記事を収集'}
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s === 'pending' ? '未処理' : s === 'approved' ? '承認済み' : s === 'rejected' ? '却下' : '全て'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-gray-400">読み込み中...</div>
        ) : articles.length === 0 ? (
          <div className="p-8 text-center text-gray-400">記事がありません</div>
        ) : (
          articles.map((article) => (
            <div key={article.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {article.relevance_score !== null && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        関連度: {article.relevance_score}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(article.fetched_at)}</span>
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm mb-0.5">
                    {article.translated_title_ja ?? article.original_title}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">{article.original_title}</p>
                  {article.summary_ja && (
                    <p className="text-sm text-gray-600">{article.summary_ja}</p>
                  )}
                  {article.key_insights && article.key_insights.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {article.key_insights.map((insight, i) => (
                        <li key={i} className="text-xs text-gray-500 flex items-start gap-1">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  )}
                  <a
                    href={article.original_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:underline mt-2 block"
                  >
                    元記事を見る →
                  </a>
                </div>
                {article.status === 'pending' && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => updateStatus(article.id, 'approved')}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      承認
                    </button>
                    <button
                      onClick={() => updateStatus(article.id, 'rejected')}
                      className="px-3 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                    >
                      却下
                    </button>
                  </div>
                )}
                {article.status !== 'pending' && (
                  <span
                    className={`shrink-0 px-2 py-1 text-xs rounded font-medium ${
                      article.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {article.status === 'approved' ? '承認済み' : '却下'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
