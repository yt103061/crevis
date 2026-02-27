'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'

interface LPCandidate {
  id: string
  url: string
  source_type: string
  source_name: string | null
  discovered_at: string
  lp_confidence_score: number | null
  is_likely_lp: boolean | null
  page_title: string | null
  page_domain: string | null
  status: string
  rejection_reason: string | null
}

const STATUS_FILTERS = [
  { value: 'new', label: '未レビュー' },
  { value: 'auto_accepted', label: '自動承認' },
  { value: 'accepted', label: '承認済み' },
  { value: 'rejected', label: '却下' },
  { value: '', label: '全て' },
]

export default function LPCandidatesPage() {
  const [candidates, setCandidates] = useState<LPCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('new')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    loadCandidates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  async function loadCandidates() {
    setLoading(true)
    setFetchError('')
    setSelected(new Set())
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/admin/lp-candidates${params}`)
      const data = await res.json()
      if (!res.ok) {
        setFetchError(data.error ?? `エラー ${res.status}`)
        setCandidates([])
      } else {
        setCandidates(data.candidates ?? [])
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '読み込みに失敗しました')
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }

  async function collectCandidates() {
    setCollecting(true)
    try {
      const res = await fetch('/api/admin/lp-candidates/collect', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        alert(
          `収集完了\n新規候補: ${data.newCandidates}件\n自動承認: ${data.autoAccepted}件` +
          (data.sourceErrors?.length ? `\nエラー: ${data.sourceErrors.join(', ')}` : '')
        )
        loadCandidates()
      } else {
        alert(data.error ?? '収集に失敗しました')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '収集に失敗しました')
    } finally {
      setCollecting(false)
    }
  }

  async function updateCandidate(id: string, action: 'accept' | 'reject') {
    setProcessingId(id)
    try {
      const res = await fetch(`/api/admin/lp-candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? '操作に失敗しました')
      } else {
        loadCandidates()
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作に失敗しました')
    } finally {
      setProcessingId(null)
    }
  }

  async function bulkAction(action: 'accept' | 'reject') {
    if (selected.size === 0) return
    const label = action === 'accept' ? '承認' : '却下'
    if (!confirm(`選択した${selected.size}件を${label}しますか？`)) return
    setBulkProcessing(true)
    try {
      const res = await fetch('/api/admin/lp-candidates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      })
      const data = await res.json()
      alert(`${label}完了: ${data.success}件成功, ${data.failed ?? 0}件失敗`)
      loadCandidates()
    } catch (e) {
      alert(e instanceof Error ? e.message : '一括操作に失敗しました')
    } finally {
      setBulkProcessing(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === candidates.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(candidates.map((c) => c.id)))
    }
  }

  const reviewable = candidates.filter((c) => c.status === 'new' || c.status === 'auto_accepted')

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#111111]">LP候補</h1>
          {!loading && (
            <p className="text-xs text-[#767b74] mt-0.5">
              {candidates.length}件表示中
              {reviewable.length > 0 && statusFilter !== 'accepted' && statusFilter !== 'rejected' &&
                ` (${reviewable.length}件レビュー待ち)`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <>
              <button
                onClick={() => bulkAction('accept')}
                disabled={bulkProcessing}
                className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
              >
                {bulkProcessing ? '処理中...' : `一括承認 (${selected.size}件)`}
              </button>
              <button
                onClick={() => bulkAction('reject')}
                disabled={bulkProcessing}
                className="px-3 py-2 text-sm border border-[#d9dbd6] text-[#5e625c] rounded-lg hover:bg-[#f1f1ee] disabled:opacity-50"
              >
                一括却下 ({selected.size}件)
              </button>
            </>
          )}
          <button
            onClick={collectCandidates}
            disabled={collecting}
            className="px-3 py-2 text-sm bg-[#111111] text-white rounded-lg hover:bg-[#2a2a2a] disabled:opacity-50 font-medium"
          >
            {collecting ? '収集中...' : 'ギャラリーから収集'}
          </button>
        </div>
      </div>

      {/* 仕組み説明 */}
      <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded-xl p-3 mb-4 text-xs text-[#1d4ed8] leading-relaxed">
        <strong>LP候補の収集フロー：</strong>
        LPアーカイブ・SANKOU!等のギャラリーサイトから人間が選定済みのLP URLを自動収集 →
        LP判定スコアを算出（70以上は自動承認） → レビューして承認するとLP一覧に登録・AI分析を実行。
        LP収集ソースは「LP収集ソース管理」から設定できます。
      </div>

      {/* フィルタータブ */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              statusFilter === value
                ? 'bg-[#111111] text-white'
                : 'bg-white border border-[#d9dbd6] text-[#5e625c] hover:bg-[#f1f1ee]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {fetchError && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center justify-between gap-2">
          <span>{fetchError}</span>
          <button onClick={loadCandidates} className="text-xs underline shrink-0">再読み込み</button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-[#8a8f88] text-sm">読み込み中...</div>
      ) : candidates.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[#8a8f88] text-sm mb-3">候補がありません</p>
          <button
            onClick={collectCandidates}
            disabled={collecting}
            className="px-4 py-2 bg-[#111111] text-white text-sm rounded-lg hover:bg-[#2a2a2a] disabled:opacity-50"
          >
            ギャラリーから収集する
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#d9dbd6] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#e3e5e0]">
              <thead className="bg-[#f7f7f5]">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === candidates.length && candidates.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-[#d9dbd6]"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide">URL / ドメイン</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide whitespace-nowrap">LP判定</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide whitespace-nowrap">ソース</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide whitespace-nowrap">発見日</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e625c] uppercase tracking-wide">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e5e0]">
                {candidates.map((candidate) => {
                  const isAutoAccepted = candidate.status === 'auto_accepted'
                  return (
                    <tr
                      key={candidate.id}
                      className={`hover:bg-[#fafafa] transition-colors ${isAutoAccepted ? 'bg-emerald-50/30' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(candidate.id)}
                          onChange={() => toggleSelect(candidate.id)}
                          className="rounded border-[#d9dbd6]"
                        />
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="min-w-0">
                          {candidate.page_title && (
                            <p className="text-sm font-medium text-[#111111] truncate">{candidate.page_title}</p>
                          )}
                          <a
                            href={candidate.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#1d4ed8] hover:underline truncate block"
                          >
                            {candidate.url}
                          </a>
                          <p className="text-xs text-[#8a8f88]">{candidate.page_domain}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {candidate.lp_confidence_score != null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-[#e3e5e0] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  candidate.lp_confidence_score >= 70 ? 'bg-emerald-500' :
                                  candidate.lp_confidence_score >= 40 ? 'bg-amber-400' : 'bg-rose-400'
                                }`}
                                style={{ width: `${candidate.lp_confidence_score}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-[#111111]">{candidate.lp_confidence_score}</span>
                            {isAutoAccepted && (
                              <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 rounded">自動</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[#8a8f88]">未計測</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#5e625c] whitespace-nowrap">
                        {candidate.source_name ?? candidate.source_type}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#767b74] whitespace-nowrap">
                        {formatDate(candidate.discovered_at)}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.status === 'new' || candidate.status === 'auto_accepted' ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <button
                              onClick={() => updateCandidate(candidate.id, 'accept')}
                              disabled={processingId === candidate.id}
                              className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                            >
                              {processingId === candidate.id ? '処理中...' : '承認'}
                            </button>
                            <button
                              onClick={() => updateCandidate(candidate.id, 'reject')}
                              disabled={processingId === candidate.id}
                              className="text-xs text-rose-600 hover:underline disabled:opacity-50"
                            >
                              却下
                            </button>
                          </div>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            candidate.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' :
                            'bg-[#f1f1ee] text-[#5e625c]'
                          }`}>
                            {candidate.status === 'accepted' ? '承認済み' : '却下済み'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
