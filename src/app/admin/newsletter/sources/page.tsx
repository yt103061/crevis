'use client'

import { useEffect, useState } from 'react'
import type { NLSource } from '@/types'
import { formatDate } from '@/lib/utils'

export default function NLSourcesPage() {
  const [sources, setSources] = useState<NLSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', type: 'rss', language: 'en' })

  useEffect(() => {
    fetchSources()
  }, [])

  async function fetchSources() {
    const res = await fetch('/api/admin/nl/sources')
    const data = await res.json()
    setSources(data.sources ?? [])
    setLoading(false)
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/nl/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({ name: '', url: '', type: 'rss', language: 'en' })
      setShowForm(false)
      fetchSources()
    }
  }

  async function toggleSource(id: string, active: boolean) {
    await fetch(`/api/admin/nl/sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    fetchSources()
  }

  async function deleteSource(id: string) {
    if (!confirm('削除しますか？')) return
    await fetch(`/api/admin/nl/sources/${id}`, { method: 'DELETE' })
    fetchSources()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">NLソース管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          + ソース追加
        </button>
      </div>

      {showForm && (
        <form onSubmit={addSource} className="bg-white rounded-lg border border-gray-200 p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ソース名</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ConversionXL"
                required
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">RSS URL</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://cxl.com/feed/"
                required
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
              追加
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">読み込み中...</div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center text-gray-400">ソースが登録されていません</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ソース名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">最終取得</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sources.map((source) => (
                <tr key={source.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-sm text-gray-900">{source.name}</td>
                  <td className="px-4 py-3">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-500 hover:underline truncate block max-w-xs"
                    >
                      {source.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {source.last_fetched_at ? formatDate(source.last_fetched_at) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        source.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {source.active ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleSource(source.id, !source.active)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        {source.active ? '無効化' : '有効化'}
                      </button>
                      <button
                        onClick={() => deleteSource(source.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        削除
                      </button>
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
