'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { NewsletterIssue, NLArticle } from '@/types'
import { formatDate } from '@/lib/utils'

const statusLabel: Record<string, string> = {
  draft: 'ドラフト',
  ready: '配信準備完了',
  sent: '配信済み',
}
const statusStyle: Record<string, string> = {
  draft: 'bg-[#f1f1ee] text-[#5e625c]',
  ready: 'bg-blue-50 text-blue-700',
  sent: 'bg-emerald-50 text-emerald-700',
}

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [issue, setIssue] = useState<NewsletterIssue | null>(null)
  const [articles, setArticles] = useState<Partial<NLArticle>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showHtml, setShowHtml] = useState(false)

  useEffect(() => {
    loadIssue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadIssue() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/nl/issues/${id}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `エラー ${res.status}`)
      } else {
        setIssue(data.issue)
        setArticles(data.articles ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(status: string) {
    if (!issue) return
    const res = await fetch(`/api/admin/nl/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) loadIssue()
    else alert('ステータスの更新に失敗しました')
  }

  async function sendIssue() {
    if (!confirm('本当に配信しますか？配信後は取り消しできません。')) return
    setSending(true)
    try {
      const res = await fetch(`/api/admin/nl/issues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      })
      const data = await res.json()
      if (res.ok) {
        alert(`配信完了: ${data.sentCount}件送信`)
        loadIssue()
      } else {
        alert(data.error ?? '配信に失敗しました')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '配信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  async function deleteIssue() {
    if (!issue || !confirm(`第${issue.issue_number}号を削除しますか？`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/nl/issues/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/admin/newsletter/issues')
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? '削除に失敗しました')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="py-16 text-center text-[#8a8f88] text-sm">読み込み中...</div>
  if (error) return (
    <div className="py-8">
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 mb-4">{error}</div>
      <Link href="/admin/newsletter/issues" className="text-sm text-[#1d4ed8] hover:underline">← 号一覧に戻る</Link>
    </div>
  )
  if (!issue) return null

  return (
    <div className="max-w-3xl">
      {/* パンくず */}
      <nav className="flex items-center gap-2 text-xs text-[#767b74] mb-4">
        <Link href="/admin/newsletter/issues" className="hover:text-[#111111]">号管理</Link>
        <span>/</span>
        <span className="text-[#111111]">第{issue.issue_number}号</span>
      </nav>

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-[#1d4ed8] bg-[#eef2ff] px-2.5 py-0.5 rounded">
              #{issue.issue_number}
            </span>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[issue.status] ?? 'bg-[#f1f1ee] text-[#5e625c]'}`}>
              {statusLabel[issue.status] ?? issue.status}
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#111111]">{issue.title}</h1>
          <p className="text-xs text-[#767b74] mt-1">
            作成: {formatDate(issue.created_at)}
            {issue.sent_at && ` · 配信: ${formatDate(issue.sent_at)}`}
            {issue.recipient_count != null && ` · ${issue.recipient_count}人に配信`}
          </p>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2 flex-wrap">
          {issue.status === 'draft' && (
            <button
              onClick={() => updateStatus('ready')}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              準備完了にする
            </button>
          )}
          {issue.status === 'ready' && (
            <button
              onClick={sendIssue}
              disabled={sending}
              className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50"
            >
              {sending ? '配信中...' : '配信する'}
            </button>
          )}
          {issue.status !== 'sent' && (
            <button
              onClick={deleteIssue}
              disabled={deleting}
              className="px-3 py-2 text-sm border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 disabled:opacity-50"
            >
              {deleting ? '削除中...' : '削除'}
            </button>
          )}
        </div>
      </div>

      {/* 採用記事一覧 */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold text-[#5e625c] uppercase tracking-wide mb-3">
          採用記事 {articles.length > 0 ? `(${articles.length}件)` : ''}
        </h2>
        {articles.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#d9dbd6] p-4 text-sm text-[#8a8f88] text-center">
            採用記事が未設定です。自動化を実行すると承認済み記事から自動選択されます。
          </div>
        ) : (
          <div className="space-y-2">
            {articles.map((article) => (
              <div key={article.id} className="bg-white rounded-xl border border-[#d9dbd6] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[#111111]">
                      {article.translated_title_ja ?? article.original_title}
                    </p>
                    {article.translated_title_ja && (
                      <p className="text-xs text-[#8a8f88] mt-0.5">{article.original_title}</p>
                    )}
                    {article.summary_ja && (
                      <p className="text-xs text-[#767b74] mt-1.5 line-clamp-2">{article.summary_ja}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {article.relevance_score != null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        article.relevance_score >= 70 ? 'bg-emerald-50 text-emerald-700' :
                        article.relevance_score >= 50 ? 'bg-amber-50 text-amber-700' :
                        'bg-[#f1f1ee] text-[#5e625c]'
                      }`}>
                        {article.relevance_score}点
                      </span>
                    )}
                    {article.original_url && (
                      <a
                        href={article.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#1d4ed8] hover:underline"
                      >
                        元記事 →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* HTMLコンテンツ */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[#5e625c] uppercase tracking-wide">
            HTMLコンテンツ
          </h2>
          {issue.content_html && (
            <button
              onClick={() => setShowHtml(!showHtml)}
              className="text-xs text-[#1d4ed8] hover:underline"
            >
              {showHtml ? 'ソースを隠す' : 'ソースを表示'}
            </button>
          )}
        </div>

        {!issue.content_html ? (
          <div className="bg-white rounded-xl border border-[#d9dbd6] p-4 text-sm text-[#8a8f88] text-center">
            HTMLコンテンツが未生成です。「自動化を実行」すると承認済み記事からHTMLが自動生成されます。
          </div>
        ) : (
          <div className="space-y-3">
            {/* プレビュー */}
            <div className="bg-white rounded-xl border border-[#d9dbd6] p-4">
              <p className="text-xs text-[#8a8f88] mb-2 font-medium">プレビュー</p>
              <div
                className="prose prose-sm max-w-none text-[#111111]"
                dangerouslySetInnerHTML={{ __html: issue.content_html }}
              />
            </div>
            {/* HTMLソース */}
            {showHtml && (
              <div className="bg-[#1e1e1e] rounded-xl p-4 overflow-x-auto">
                <pre className="text-xs text-[#d4d4d4] whitespace-pre-wrap break-all font-mono">
                  {issue.content_html}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
