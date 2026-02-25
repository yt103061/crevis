'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { LPWithAnalysis } from '@/types'
import { formatDate, scoreBg } from '@/lib/utils'

export default function AdminLPsPage() {
  const [lps, setLps] = useState<LPWithAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [filter, setFilter] = useState({ status: 'active', industry: '', sortBy: 'created_at' })

  useEffect(() => {
    fetchLPs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function fetchLPs() {
    setLoading(true)
    let query = supabase
      .from('lps')
      .select('*, lp_analyses(*)')
      .order(
        filter.sortBy === 'score'
          ? 'lp_analyses(total_score)'
          : 'created_at',
        { ascending: false }
      )

    if (filter.status) query = query.eq('status', filter.status)
    if (filter.industry) query = query.eq('industry', filter.industry)

    const { data } = await query.limit(100)
    setLps((data as LPWithAnalysis[]) ?? [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/lps/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) fetchLPs()
  }


  async function discoverLPs() {
    setDiscovering(true)
    const res = await fetch('/api/admin/lps/discover', { method: 'POST' })
    const data = await res.json()
    setDiscovering(false)

    if (!res.ok) {
      alert(data.error ?? '自動発見に失敗しました')
      return
    }

    const results = data.results
    alert(
      `自動発見完了
候補: ${results.discovered}件
登録: ${results.inserted}件
分析: ${results.analyzed}件
公開: ${results.activated}件
スキップ: ${results.skipped}件
ヒューリスティック除外: ${results.heuristic_skipped ?? 0}件
エラー: ${results.errors}件`
    )
    fetchLPs()
  }

  async function reanalyze(id: string) {
    const res = await fetch(`/api/admin/lps/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reanalyze' }),
    })
    if (res.ok) {
      alert('分析を再実行しました')
      fetchLPs()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">LP一覧</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={discoverLPs}
            disabled={discovering}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {discovering ? '収集中...' : 'Webから自動発見'}
          </button>
          <Link
            href="/admin/lps/new"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
          >
            + LP登録
          </Link>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex gap-3 mb-4">
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white"
        >
          <option value="active">公開中</option>
          <option value="archived">アーカイブ</option>
          <option value="takedown">削除申請</option>
          <option value="">全て</option>
        </select>
        <select
          value={filter.sortBy}
          onChange={(e) => setFilter((f) => ({ ...f, sortBy: e.target.value }))}
          className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white"
        >
          <option value="created_at">登録日順</option>
          <option value="score">スコア順</option>
        </select>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">読み込み中...</div>
        ) : lps.length === 0 ? (
          <div className="p-8 text-center text-gray-400">LPが登録されていません</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">タイトル / URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">業界</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">スコア</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">登録日</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lps.map((lp) => {
                const analysis = lp.lp_analyses?.[0]
                return (
                  <tr key={lp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm truncate max-w-xs">
                        {lp.title ?? '(タイトルなし)'}
                      </div>
                      <a
                        href={lp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-500 hover:underline truncate block max-w-xs"
                      >
                        {lp.url}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{lp.industry ?? '-'}</td>
                    <td className="px-4 py-3">
                      {analysis ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${scoreBg(analysis.total_score)}`}>
                          {analysis.total_score}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">未分析</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(lp.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => reanalyze(lp.id)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          再分析
                        </button>
                        {lp.status === 'active' && (
                          <button
                            onClick={() => updateStatus(lp.id, 'archived')}
                            className="text-xs text-gray-500 hover:underline"
                          >
                            アーカイブ
                          </button>
                        )}
                        {lp.status === 'archived' && (
                          <button
                            onClick={() => updateStatus(lp.id, 'active')}
                            className="text-xs text-green-600 hover:underline"
                          >
                            公開
                          </button>
                        )}
                        {lp.status === 'takedown' && (
                          <button
                            onClick={() => updateStatus(lp.id, 'archived')}
                            className="text-xs text-orange-600 hover:underline"
                          >
                            削除処理済み
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
