'use client'

import { useEffect, useState } from 'react'

type Source = { id: string; name: string; type: string; active: boolean; last_fetched_at: string | null; total_collected: number }

export default function LPSourcesPage() {
  const [items, setItems] = useState<Source[]>([])
  const [form, setForm] = useState({ name: '', type: 'gallery', config: '{}', active: true })

  async function load() {
    const res = await fetch('/api/admin/lp-sources')
    const data = await res.json()
    setItems(data.items ?? [])
  }

  useEffect(() => { load() }, [])

  async function addSource() {
    await fetch('/api/admin/lp-sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, config: JSON.parse(form.config) }),
    })
    setForm({ name: '', type: 'gallery', config: '{}', active: true })
    await load()
  }

  async function toggle(source: Source) {
    await fetch('/api/admin/lp-sources', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: source.id, active: !source.active }),
    })
    await load()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">LP収集ソース</h1>
      <div className="bg-white p-4 border rounded space-y-2">
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="name" className="border px-2 py-1 rounded w-full" />
        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="border px-2 py-1 rounded w-full"><option value="gallery">gallery</option><option value="google_query">google_query</option></select>
        <textarea value={form.config} onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))} className="border px-2 py-1 rounded w-full" rows={4} />
        <label className="text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> active</label>
        <button onClick={addSource} className="px-3 py-2 bg-indigo-600 text-white rounded text-sm">追加</button>
      </div>
      <table className="w-full bg-white border rounded text-sm">
        <thead><tr className="border-b"><th>name</th><th>type</th><th>active</th><th>last_fetched_at</th><th>total_collected</th><th></th></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b"><td>{item.name}</td><td>{item.type}</td><td>{item.active ? 'true' : 'false'}</td><td>{item.last_fetched_at ? new Date(item.last_fetched_at).toLocaleString() : '-'}</td><td>{item.total_collected}</td><td><button onClick={() => toggle(item)} className="px-2 py-1 border rounded">切替</button></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
