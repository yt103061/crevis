'use client'

import { useCallback, useEffect, useState } from 'react'

type Candidate = {
  id: string
  url: string
  page_domain: string | null
  source_name: string | null
  lp_confidence_score: number | null
  status: string
  discovered_at: string
}

export default function LPCandidatesPage() {
  const [items, setItems] = useState<Candidate[]>([])
  const [status, setStatus] = useState('new')
  const [selected, setSelected] = useState<string[]>([])

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ status })
    const res = await fetch(`/api/admin/lp-candidates/list?${qs.toString()}`)
    const data = await res.json()
    setItems(data.items ?? [])
  }, [status])

  async function collect() {
    await fetch('/api/admin/lp-candidates/collect', { method: 'POST' })
    await load()
  }

  async function updateOne(id: string, nextStatus: 'accepted' | 'rejected') {
    await fetch(`/api/admin/lp-candidates/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }),
    })
    await load()
  }

  async function bulk(action: 'accept' | 'reject') {
    await fetch('/api/admin/lp-candidates/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selected, action }),
    })
    setSelected([])
    await load()
  }

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">LP候補</h1>
        <button onClick={collect} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded">収集実行</button>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1 text-sm">
          {['new', 'auto_accepted', 'accepted', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button disabled={!selected.length} onClick={() => bulk('accept')} className="px-2 py-1 border rounded text-sm">一括承認</button>
        <button disabled={!selected.length} onClick={() => bulk('reject')} className="px-2 py-1 border rounded text-sm">一括却下</button>
      </div>

      <table className="w-full bg-white border rounded text-sm">
        <thead><tr className="border-b"><th></th><th>URL</th><th>ドメイン</th><th>ソース</th><th>スコア</th><th>ステータス</th><th>発見日</th><th>操作</th></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={`border-b ${item.status === 'auto_accepted' ? 'bg-green-50' : ''}`}>
              <td><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, item.id] : prev.filter((x) => x !== item.id))} /></td>
              <td className="p-2 truncate max-w-[300px]">{item.url}</td>
              <td>{item.page_domain ?? '-'}</td>
              <td>{item.source_name ?? '-'}</td>
              <td>{item.lp_confidence_score ?? '-'}</td>
              <td>{item.status}</td>
              <td>{new Date(item.discovered_at).toLocaleDateString()}</td>
              <td className="space-x-1">
                <button onClick={() => updateOne(item.id, 'accepted')} className="px-2 py-1 border rounded">承認</button>
                <button onClick={() => updateOne(item.id, 'rejected')} className="px-2 py-1 border rounded">却下</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
