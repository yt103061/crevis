'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'

interface LPCollectionSource {
  id: string
  name: string
  type: string
  config: Record<string, unknown>
  active: boolean
  last_fetched_at: string | null
  total_collected: number
  created_at: string
}

export default function LPSourcesPage() {
  const [sources, setSources] = useState<LPCollectionSource[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'gallery',
    config: '{}',
    active: true,
  })
  const [configError, setConfigError] = useState('')

  useEffect(() => {
    loadSources()
  }, [])

  async function loadSources() {
    setLoading(true)
    setFetchError('')
    try {
      const res = await fetch('/api/admin/lp-sources')
      const data = await res.json()
      if (!res.ok) {
        setFetchError(data.error ?? `エラー ${res.status}`)
        setSources([])
      } else {
        setSources(data.sources ?? [])
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(source: LPCollectionSource) {
    setEditingId(source.id)
    setForm({
      name: source.name,
      type: source.type,
      config: JSON.stringify(source.config, null, 2),
      active: source.active,
    })
    setShowForm(true)
    setConfigError('')
  }

  function resetForm() {
    setEditingId(null)
    setForm({ name: '', type: 'gallery', config: '{}', active: true })
    setShowForm(false)
    setConfigError('')
  }

  async function saveSource(e: React.FormEvent) {
    e.preventDefault()
    setConfigError('')
    let parsedConfig: unknown
    try {
      parsedConfig = JSON.parse(form.config)
    } catch {
      setConfigError('JSONが無効です。正しい形式で入力してください。')
      return
    }

    setSaving(true)
    try {
      const url = editingId ? `/api/admin/lp-sources/${editingId}` : '/api/admin/lp-sources'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, config: parsedConfig }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? '保存に失敗しました')
      } else {
        resetForm()
        loadSources()
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(source: LPCollectionSource) {
    const res = await fetch(`/api/admin/lp-sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !source.active }),
    })
    if (res.ok) loadSources()
    else alert('更新に失敗しました')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#111111]">LP収集ソース管理</h1>
          <p className="text-xs text-[#767b74] mt-0.5">LPギャラリーサイトの収集設定を管理します</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="px-3 py-2 text-sm bg-[#111111] text-white rounded-lg hover:bg-[#2a2a2a] font-medium"
        >
          + ソースを追加
        </button>
      </div>

      {/* フォーム */}
      {showForm && (
        <form onSubmit={saveSource} className="bg-white rounded-xl border border-[#d9dbd6] p-5 mb-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-4">{editingId ? 'ソースを編集' : '新規ソースを追加'}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#111111] mb-1">ソース名 <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="例: LPアーカイブ"
                className="w-full border border-[#d9dbd6] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#111111] mb-1">タイプ</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full border border-[#d9dbd6] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#111111]"
              >
                <option value="gallery">gallery（LPギャラリーサイト）</option>
                <option value="google_query">google_query（将来実装予定）</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#111111] mb-1">
                設定 (JSON)
                <span className="text-xs text-[#8a8f88] ml-2 font-normal">gallery: base_url, list_selector, link_selector, max_pages</span>
              </label>
              <textarea
                value={form.config}
                onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))}
                rows={6}
                className="w-full border border-[#d9dbd6] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#111111]"
                placeholder='{"base_url": "https://...", "list_selector": ".item", "link_selector": "a.external", "max_pages": 3}'
              />
              {configError && <p className="text-xs text-rose-600 mt-1">{configError}</p>}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="rounded border-[#d9dbd6]"
              />
              <label htmlFor="active" className="text-sm text-[#111111]">有効にする</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#111111] text-white text-sm rounded-lg hover:bg-[#2a2a2a] disabled:opacity-50 font-medium"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-[#d9dbd6] text-[#5e625c] text-sm rounded-lg hover:bg-[#f1f1ee]"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {fetchError && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center justify-between gap-2">
          <span>{fetchError}</span>
          <button onClick={loadSources} className="text-xs underline shrink-0">再読み込み</button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[#8a8f88] text-sm">読み込み中...</div>
      ) : (
        <div className="space-y-3">
          {sources.length === 0 ? (
            <div className="py-12 text-center text-[#8a8f88] text-sm">収集ソースがありません</div>
          ) : sources.map((source) => (
            <div key={source.id} className={`bg-white rounded-xl border p-4 ${source.active ? 'border-[#d9dbd6]' : 'border-[#e3e5e0] opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-[#111111]">{source.name}</span>
                    <span className="text-xs bg-[#f1f1ee] text-[#5e625c] px-1.5 py-0.5 rounded">{source.type}</span>
                    {source.active ? (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">有効</span>
                    ) : (
                      <span className="text-xs bg-[#f1f1ee] text-[#8a8f88] px-1.5 py-0.5 rounded">無効</span>
                    )}
                  </div>
                  <p className="text-xs text-[#8a8f88] font-mono truncate">
                    {(source.config as { base_url?: string }).base_url ?? JSON.stringify(source.config).slice(0, 80)}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#767b74]">
                    <span>収集: {source.total_collected}件</span>
                    {source.last_fetched_at && <span>最終収集: {formatDate(source.last_fetched_at)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(source)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium ${
                      source.active
                        ? 'border-[#d9dbd6] text-[#5e625c] hover:bg-[#f1f1ee]'
                        : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {source.active ? '無効化' : '有効化'}
                  </button>
                  <button
                    onClick={() => startEdit(source)}
                    className="text-xs px-2.5 py-1.5 border border-[#d9dbd6] text-[#5e625c] rounded-lg hover:bg-[#f1f1ee]"
                  >
                    編集
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
