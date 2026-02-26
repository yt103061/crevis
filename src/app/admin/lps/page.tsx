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
  const [filter, setFilter] = useState({ status: '', industry: '', sortBy: 'created_at' })

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
    else alert('ステータス更新に失敗しました')
  }

  async function deleteLp(id: string, title: string) {
    if (!confirm(`「${title || 'このLP'}」を完全に削除しますか？\nこの操作は取り消せません。`)) return
    const res = await fetch(`/api/admin/lps/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchLPs()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? '削除に失敗しました')
    }
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
    const feedErr = (results.feed_error_details ?? []).slice(0, 3).join(' / ')
    alert(
      `自動発見完了\n候補: ${results.discovered}件\n登録: ${results.inserted}件\n分析: ${results.analyzed}件\n公開: ${results.activated}件\nスキップ: ${results.skipped}件\nヒューリスティック除外: ${results.heuristic_skipped ?? 0}件\nエラー: ${results.errors}件\nフィードエラー: ${results.feed_errors ?? 0}件${feedErr ? `\n詳細: ${feedErr}` : ''}`
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
    } else {
      alert('再分析に失敗しました')
    }
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#111111]">LP一覧</h1>
          {!loading && (
            <p className="text-xs text-[#767b74] mt-0.5">{lps.length}件表示中</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={discoverLPs}
            disabled={discovering}
            className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {discovering ? '収集中...' : 'Webから自動発見'}
          </button>
          <Link
            href="/admin/lps/new"
            className="px-3 py-2 bg-[#111111] text-white text-sm font-medium rounded-lg hover:bg-[#2a2a2a] transition-colors"
          >
            + LP登録
          </Link>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className="text-sm border border-[#d9dbd6] rounded-lg px-3 py-2 bg-white text-[#111111] focus:outline-none focus:border-[#111111]"
        >
          <option value="">全て</option>
          <option value="active">公開中</option>
          <option value="archived">アーカイブ</option>
          <option value="takedown">削除申請</option>
        </select>
        <select
          value={filter.sortBy}
          onChange={(e) => setFilter((f) => ({ ...f, sortBy: e.target.value }))}
          className="text-sm border border-[#d9dbd6] rounded-lg px-3 py-2 bg-white text-[#111111] focus:outline-none focus:border-[#111111]"
        >
          <option value="created_at">登録日順</option>
          <option value="score">スコア順</option>
        </select>
        <button
          onClick={fetchLPs}
          className="px-3 py-2 text-sm border border-[#d9dbd6] rounded-lg bg-white text-[#5e625c] hover:bg-[#f1f1ee] transition-colors"
        >
          更新
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[#8a8f88] text-sm">読み込み中...</div>
      ) : lps.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[#8a8f88] text-sm mb-3">LPが登録されていません</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={discoverLPs}
              disabled={discovering}
              className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              Webから自動発見
            </button>
            <Link href="/admin/lps/new" className="px-3 py-2 bg-[#111111] text-white text-sm font-medium rounded-lg hover:bg-[#2a2a2a]">
              手動で登録
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* モバイルカードビュー */}
          <div className="sm:hidden space-y-3">
            {lps.map((lp) => {
              const analysis = lp.lp_analyses?.[0]
              return (
                <div key={lp.id} className="bg-white border border-[#d9dbd6] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/lps/${lp.id}`}
                        className="font-medium text-[#111111] text-sm truncate hover:text-[#1d4ed8] hover:underline block"
                      >
                        {lp.title ?? '(タイトルなし)'}
                      </Link>
                      <a
                        href={lp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#1d4ed8] hover:underline truncate block max-w-full mt-0.5"
                      >
                        {lp.url}
                      </a>
                    </div>
                    {analysis ? (
                      <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-num ${scoreBg(analysis.total_score)}`}>
                        {analysis.total_score}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-[#8a8f88]">未分析</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#767b74] mb-3 flex-wrap">
                    {lp.industry && (
                      <span className="bg-[#f1f1ee] px-2 py-0.5 rounded text-[#5e625c]">{lp.industry}</span>
                    )}
                    <span>{formatDate(lp.created_at)}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      lp.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                      lp.status === 'archived' ? 'bg-[#f1f1ee] text-[#5e625c]' :
                      'bg-rose-50 text-rose-700'
                    }`}>
                      {lp.status === 'active' ? '公開中' : lp.status === 'archived' ? 'アーカイブ' : '削除申請'}
                    </span>
                  </div>

                  <div className="flex gap-3 flex-wrap border-t border-[#e3e5e0] pt-3">
                    <button
                      onClick={() => reanalyze(lp.id)}
                      className="text-xs font-medium text-[#1d4ed8] hover:underline"
                    >
                      再分析
                    </button>
                    {lp.status === 'active' && (
                      <button
                        onClick={() => updateStatus(lp.id, 'archived')}
                        className="text-xs text-[#5e625c] hover:underline"
                      >
                        アーカイブ
                      </button>
                    )}
                    {lp.status === 'archived' && (
                      <button
                        onClick={() => updateStatus(lp.id, 'active')}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        公開に戻す
                      </button>
                    )}
                    {lp.status === 'takedown' && (
                      <button
                        onClick={() => updateStatus(lp.id, 'archived')}
                        className="text-xs text-amber-600 hover:underline"
                      >
                        削除処理済み
                      </button>
                    )}
                    <button
                      onClick={() => deleteLp(lp.id, lp.title ?? '')}
                      className="text-xs text-rose-600 hover:underline ml-auto"
                    >
                      完全削除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* デスクトップテーブルビュー */}
          <div className="hidden sm:block bg-white rounded-xl border border-[#d9dbd6] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#e3e5e0]">
                <thead className="bg-[#f7f7f5]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide">タイトル / URL</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide whitespace-nowrap">業界</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide">スコア</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide whitespace-nowrap">登録日</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e5e0]">
                  {lps.map((lp) => {
                    const analysis = lp.lp_analyses?.[0]
                    return (
                      <tr key={lp.id} className="hover:bg-[#fafafa] transition-colors">
                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex items-center gap-2">
                            <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                              lp.status === 'active' ? 'bg-emerald-500' :
                              lp.status === 'archived' ? 'bg-[#b0b5ae]' :
                              'bg-rose-500'
                            }`} />
                            <div className="min-w-0">
                              <Link
                                href={`/admin/lps/${lp.id}`}
                                className="font-medium text-[#111111] text-sm truncate hover:text-[#1d4ed8] hover:underline block"
                              >
                                {lp.title ?? '(タイトルなし)'}
                              </Link>
                              <a
                                href={lp.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#1d4ed8] hover:underline truncate block"
                              >
                                {lp.url}
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#5e625c] whitespace-nowrap">{lp.industry ?? '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {analysis ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-num ${scoreBg(analysis.total_score)}`}>
                              {analysis.total_score}
                            </span>
                          ) : (
                            <span className="text-xs text-[#8a8f88]">未分析</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#767b74] whitespace-nowrap">{formatDate(lp.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 whitespace-nowrap">
                            <button
                              onClick={() => reanalyze(lp.id)}
                              className="text-xs text-[#1d4ed8] hover:underline font-medium"
                            >
                              再分析
                            </button>
                            {lp.status === 'active' && (
                              <button
                                onClick={() => updateStatus(lp.id, 'archived')}
                                className="text-xs text-[#5e625c] hover:underline"
                              >
                                アーカイブ
                              </button>
                            )}
                            {lp.status === 'archived' && (
                              <button
                                onClick={() => updateStatus(lp.id, 'active')}
                                className="text-xs text-emerald-600 hover:underline"
                              >
                                公開
                              </button>
                            )}
                            {lp.status === 'takedown' && (
                              <button
                                onClick={() => updateStatus(lp.id, 'archived')}
                                className="text-xs text-amber-600 hover:underline"
                              >
                                削除処理済み
                              </button>
                            )}
                            <button
                              onClick={() => deleteLp(lp.id, lp.title ?? '')}
                              className="text-xs text-rose-600 hover:underline"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
