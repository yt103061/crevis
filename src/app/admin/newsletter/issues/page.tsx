'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { NewsletterIssue } from '@/types'
import { formatDate } from '@/lib/utils'

export default function NLIssuesPage() {
  const [issues, setIssues] = useState<NewsletterIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [automating, setAutomating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchIssues()
  }, [])

  async function fetchIssues() {
    setLoading(true)
    setFetchError('')
    try {
      const res = await fetch('/api/admin/nl/issues')
      const data = await res.json()
      if (!res.ok) {
        setFetchError(data.error ?? `エラー ${res.status}`)
        setIssues([])
      } else {
        setIssues(data.issues ?? [])
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '読み込みに失敗しました')
      setIssues([])
    } finally {
      setLoading(false)
    }
  }

  async function createIssue(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/nl/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const data = await res.json()

      if (res.ok && data.issue) {
        setTitle('')
        setShowForm(false)
        // レスポンスから直接リストに追加（再取得は補完として実行）
        setIssues((prev) => [data.issue as NewsletterIssue, ...prev])
        fetchIssues() // バックグラウンドで再同期
      } else {
        setCreateError(data.error ?? `作成に失敗しました (${res.status})`)
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '通信エラーが発生しました')
    } finally {
      setCreating(false)
    }
  }

  async function runAutomation() {
    setAutomating(true)
    try {
      const res = await fetch('/api/admin/nl/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error ?? '自動化実行に失敗しました')
        return
      }

      const draftMsg = data.issueDraft?.created
        ? `号ドラフト作成: ${data.issueDraft.articleCount}件採用`
        : `号ドラフト作成: スキップ（${data.issueDraft?.reason ?? 'unknown'}）`

      alert(
        `自動化完了\n収集: ${data.fetchResults.processed}件追加 / ${data.fetchResults.skipped}件スキップ / ${data.fetchResults.errors}件エラー\n自動承認: ${data.autoApproved}件\n${draftMsg}`
      )
      await fetchIssues()
    } catch (e) {
      alert(e instanceof Error ? e.message : '自動化に失敗しました')
    } finally {
      setAutomating(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/admin/nl/issues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(`更新に失敗しました: ${data.error ?? res.status}`)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新に失敗しました')
    }
    await fetchIssues()
  }

  async function sendIssue(id: string) {
    if (!confirm('本当に配信しますか？配信後は取り消しできません。')) return
    setSending(id)
    try {
      const res = await fetch(`/api/admin/nl/issues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      })
      const data = await res.json()
      if (res.ok) {
        alert(`配信完了: ${data.sentCount}件送信`)
        await fetchIssues()
      } else {
        alert(data.error ?? '配信に失敗しました')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '配信に失敗しました')
    } finally {
      setSending(null)
    }
  }

  async function deleteIssue(id: string, issueNumber: number) {
    if (!confirm(`第${issueNumber}号を削除しますか？`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/nl/issues/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(`削除に失敗しました: ${data.error ?? res.status}`)
      } else {
        setIssues((prev) => prev.filter((i) => i.id !== id))
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    } finally {
      setDeleting(null)
    }
  }

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

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#111111]">ニュースレター号管理</h1>
          <p className="text-xs text-[#767b74] mt-0.5">
            ドラフト作成 → 準備完了 → 配信 の順で操作します
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={runAutomation}
            disabled={automating}
            className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {automating ? '自動化実行中...' : '自動化を実行'}
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setCreateError('') }}
            className="px-3 py-2 bg-[#111111] text-white text-sm font-medium rounded-lg hover:bg-[#2a2a2a] transition-colors"
          >
            + 号を作成
          </button>
        </div>
      </div>

      {/* 号作成フォーム */}
      {showForm && (
        <form onSubmit={createIssue} className="bg-white rounded-xl border border-[#d9dbd6] p-4 mb-4">
          <p className="text-sm font-medium text-[#111111] mb-3">新しい号を作成</p>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="号のタイトルを入力（例: CRO週刊 #12）"
              required
              autoFocus
              className="flex-1 input-dark text-sm"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-[#111111] text-white text-sm rounded-lg hover:bg-[#2a2a2a] disabled:opacity-50 whitespace-nowrap"
            >
              {creating ? '作成中...' : '作成'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setCreateError('') }}
              className="px-3 py-2 border border-[#d9dbd6] text-[#5e625c] text-sm rounded-lg hover:bg-[#f1f1ee]"
            >
              キャンセル
            </button>
          </div>
          {createError && (
            <p className="mt-2 text-sm text-rose-600">{createError}</p>
          )}
        </form>
      )}

      {/* ワークフロー説明 */}
      <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded-xl p-3 mb-4 flex items-start gap-2">
        <svg className="w-4 h-4 text-[#1d4ed8] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-[#1d4ed8] leading-relaxed">
          <strong>配信の手順：</strong>
          ① 「号を作成」でドラフトを作る　② 「準備完了」に変更する　③ 「配信」ボタンで購読者へ送信
          <br />「自動化を実行」を使うと、承認済み記事からドラフトを自動生成できます。
        </p>
      </div>

      {/* エラー表示 */}
      {fetchError && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center justify-between gap-2">
          <span>{fetchError}</span>
          <button onClick={fetchIssues} className="text-xs underline shrink-0">再読み込み</button>
        </div>
      )}

      {/* 一覧 */}
      {loading ? (
        <div className="py-12 text-center text-[#8a8f88] text-sm">読み込み中...</div>
      ) : issues.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[#8a8f88] text-sm mb-3">号が作成されていません</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#111111] text-white text-sm font-medium rounded-lg hover:bg-[#2a2a2a]"
          >
            最初の号を作成する
          </button>
        </div>
      ) : (
        <>
          {/* モバイルカードビュー */}
          <div className="sm:hidden space-y-3">
            {issues.map((issue) => (
              <div key={issue.id} className="bg-white border border-[#d9dbd6] rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-[#1d4ed8] bg-[#eef2ff] px-2 py-0.5 rounded">
                        #{issue.issue_number}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle[issue.status] ?? 'bg-[#f1f1ee] text-[#5e625c]'}`}>
                        {statusLabel[issue.status] ?? issue.status}
                      </span>
                    </div>
                    <Link href={`/admin/newsletter/issues/${issue.id}`} className="font-medium text-[#111111] text-sm hover:text-[#1d4ed8] hover:underline block">
                      {issue.title}
                    </Link>
                    <p className="text-xs text-[#767b74] mt-0.5">
                      {issue.sent_at ? `配信日: ${formatDate(issue.sent_at)}` : `作成日: ${formatDate(issue.created_at)}`}
                      {issue.recipient_count != null && ` · ${issue.recipient_count}人に配信`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap border-t border-[#e3e5e0] pt-3">
                  {issue.status === 'draft' && (
                    <button
                      onClick={() => updateStatus(issue.id, 'ready')}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      準備完了にする
                    </button>
                  )}
                  {issue.status === 'ready' && (
                    <button
                      onClick={() => sendIssue(issue.id)}
                      disabled={sending === issue.id}
                      className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                    >
                      {sending === issue.id ? '配信中...' : '配信する'}
                    </button>
                  )}
                  {issue.status !== 'sent' && (
                    <button
                      onClick={() => deleteIssue(issue.id, issue.issue_number)}
                      disabled={deleting === issue.id}
                      className="text-xs text-rose-600 hover:underline ml-auto disabled:opacity-50"
                    >
                      {deleting === issue.id ? '削除中...' : '削除'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* デスクトップテーブルビュー */}
          <div className="hidden sm:block bg-white rounded-xl border border-[#d9dbd6] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#e3e5e0]">
                <thead className="bg-[#f7f7f5]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide">号数</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide">タイトル</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide">ステータス</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide whitespace-nowrap">配信日</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide whitespace-nowrap">送信数</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e5e0]">
                  {issues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold font-num text-[#1d4ed8]">#{issue.issue_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/newsletter/issues/${issue.id}`} className="font-medium text-sm text-[#111111] hover:text-[#1d4ed8] hover:underline">
                          {issue.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[issue.status] ?? 'bg-[#f1f1ee] text-[#5e625c]'}`}>
                          {statusLabel[issue.status] ?? issue.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#767b74] whitespace-nowrap">
                        {issue.sent_at ? formatDate(issue.sent_at) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#5e625c]">
                        {issue.recipient_count ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          {issue.status === 'draft' && (
                            <button
                              onClick={() => updateStatus(issue.id, 'ready')}
                              className="text-xs text-blue-600 hover:underline font-medium"
                            >
                              準備完了
                            </button>
                          )}
                          {issue.status === 'ready' && (
                            <button
                              onClick={() => sendIssue(issue.id)}
                              disabled={sending === issue.id}
                              className="text-xs text-emerald-600 hover:underline font-medium disabled:opacity-50"
                            >
                              {sending === issue.id ? '配信中...' : '配信'}
                            </button>
                          )}
                          {issue.status !== 'sent' && (
                            <button
                              onClick={() => deleteIssue(issue.id, issue.issue_number)}
                              disabled={deleting === issue.id}
                              className="text-xs text-rose-600 hover:underline disabled:opacity-50"
                            >
                              {deleting === issue.id ? '削除中...' : '削除'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
