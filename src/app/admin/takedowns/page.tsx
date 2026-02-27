'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface TakedownRequest {
  id: string
  lp_id: string
  reason: string | null
  requester_email: string | null
  requester_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  lps: { title: string | null; url: string } | null
}

export default function AdminTakedownsPage() {
  const [requests, setRequests] = useState<TakedownRequest[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchRequests() {
    setLoading(true)
    const { data } = await supabase
      .from('takedown_requests')
      .select('*, lps(title, url)')
      .order('created_at', { ascending: false })
      .limit(100)
    setRequests((data ?? []) as TakedownRequest[])
    setLoading(false)
  }

  useEffect(() => { fetchRequests() }, [])

  async function resolve(id: string, lpId: string, action: 'approved' | 'rejected') {
    await supabase.from('takedown_requests').update({
      status: action,
      resolved_at: new Date().toISOString(),
    }).eq('id', id)

    if (action === 'approved') {
      await supabase.from('lps').update({ status: 'archived' }).eq('id', lpId)
    } else {
      await supabase.from('lps').update({ status: 'active' }).eq('id', lpId)
    }
    fetchRequests()
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#111111]">削除申請一覧</h1>
          {!loading && pendingCount > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">{pendingCount}件の未対応申請があります</p>
          )}
        </div>
        <button onClick={fetchRequests} className="text-sm px-3 py-2 border border-[#d9dbd6] rounded-lg hover:bg-[#f1f1ee]">
          更新
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[#8a8f88]">読み込み中...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-[#8a8f88]">削除申請はありません</p>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white border border-[#d9dbd6] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/lps/${req.lp_id}`} className="font-medium text-sm text-[#1d4ed8] hover:underline truncate block">
                    {req.lps?.title ?? '(タイトルなし)'}
                  </Link>
                  <a href={req.lps?.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#767b74] hover:underline truncate block">
                    {req.lps?.url}
                  </a>
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                  req.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  req.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                  'bg-[#f1f1ee] text-[#5e625c]'
                }`}>
                  {req.status === 'pending' ? '未対応' : req.status === 'approved' ? '承認済み' : '却下'}
                </span>
              </div>

              {req.reason && (
                <p className="mt-2 text-xs text-[#5e625c] bg-[#f7f7f5] rounded-lg px-3 py-2">{req.reason}</p>
              )}

              <div className="mt-2 flex items-center gap-4 text-xs text-[#767b74]">
                {req.requester_email && <span>📧 {req.requester_email}</span>}
                <span>申請日: {new Date(req.created_at).toLocaleDateString('ja-JP')}</span>
              </div>

              {req.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => resolve(req.id, req.lp_id, 'approved')}
                    className="px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-lg hover:bg-rose-700"
                  >
                    承認（LP非公開化）
                  </button>
                  <button
                    onClick={() => resolve(req.id, req.lp_id, 'rejected')}
                    className="px-3 py-1.5 border border-[#d9dbd6] text-xs rounded-lg hover:bg-[#f1f1ee]"
                  >
                    却下（LP復活）
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
