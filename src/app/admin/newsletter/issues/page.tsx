'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { NewsletterIssue } from '@/types'
import { formatDate } from '@/lib/utils'

export default function NLIssuesPage() {
  const [issues, setIssues] = useState<NewsletterIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [automating, setAutomating] = useState(false)

  useEffect(() => {
    fetchIssues()
  }, [])

  async function fetchIssues() {
    setLoading(true)
    const { data } = await supabase
      .from('newsletter_issues')
      .select('*')
      .order('created_at', { ascending: false })
    setIssues((data as NewsletterIssue[]) ?? [])
    setLoading(false)
  }

  async function createIssue(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await fetch('/api/admin/nl/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    setCreating(false)
    if (res.ok) {
      setTitle('')
      setShowForm(false)
      fetchIssues()
    }
  }

  async function runAutomation() {
    setAutomating(true)
    const res = await fetch('/api/admin/nl/automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    setAutomating(false)

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
    fetchIssues()
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/admin/nl/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchIssues()
  }

  async function sendIssue(id: string) {
    if (!confirm('本当に配信しますか？')) return
    setSending(id)
    const res = await fetch(`/api/admin/nl/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send' }),
    })
    setSending(null)
    const data = await res.json()
    if (res.ok) {
      alert(`配信完了: ${data.sentCount}件送信`)
      fetchIssues()
    } else {
      alert(data.error ?? '配信に失敗しました')
    }
  }

  const statusLabels: Record<string, string> = {
    draft: 'ドラフト',
    ready: '配信準備完了',
    sent: '配信済み',
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    ready: 'bg-blue-100 text-blue-700',
    sent: 'bg-green-100 text-green-700',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">ニュースレター号管理</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={runAutomation}
            disabled={automating}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {automating ? '自動化実行中...' : '自動化を実行'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
          >
            + 号を作成
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createIssue} className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="号のタイトルを入力"
            required
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? '作成中...' : '作成'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
          >
            キャンセル
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">読み込み中...</div>
        ) : issues.length === 0 ? (
          <div className="p-8 text-center text-gray-400">号が作成されていません</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">号数</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">タイトル</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">配信日</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">送信数</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm text-gray-900">#{issue.issue_number}</td>
                  <td className="px-4 py-3 font-medium text-sm text-gray-900">{issue.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[issue.status]}`}>
                      {statusLabels[issue.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {issue.sent_at ? formatDate(issue.sent_at) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {issue.recipient_count ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {issue.status === 'draft' && (
                        <button
                          onClick={() => updateStatus(issue.id, 'ready')}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          準備完了
                        </button>
                      )}
                      {issue.status === 'ready' && (
                        <button
                          onClick={() => sendIssue(issue.id)}
                          disabled={sending === issue.id}
                          className="text-xs text-green-600 hover:underline disabled:opacity-50"
                        >
                          {sending === issue.id ? '配信中...' : '配信'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
