'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const INDUSTRIES = [
  '美容・コスメ', '健康・医療', 'フィットネス', '教育・スクール',
  'IT・SaaS', 'EC・通販', '不動産', '金融・保険', '飲食', 'その他',
]

const PURPOSES = [
  'リード獲得', '商品販売', '予約獲得', '会員登録', '資料請求', 'お問い合わせ',
]

interface GalleryFiltersProps {
  currentParams: {
    industry?: string
    purpose?: string
    sort?: string
  }
}

export function GalleryFilters({ currentParams }: GalleryFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`/?${params.toString()}`)
    },
    [router, searchParams]
  )

  const toggleParam = useCallback(
    (key: string, value: string) => {
      const current = searchParams.get(key)
      updateParam(key, current === value ? '' : value)
    },
    [searchParams, updateParam]
  )

  const currentSort = currentParams.sort ?? 'newest'

  return (
    <div className="space-y-3 mb-8">
      {/* 業界フィルター */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <DarkPill
          label="すべて"
          active={!currentParams.industry}
          onClick={() => updateParam('industry', '')}
        />
        {INDUSTRIES.map((i) => (
          <DarkPill
            key={i}
            label={i}
            active={currentParams.industry === i}
            onClick={() => toggleParam('industry', i)}
          />
        ))}
      </div>

      {/* 目的 + ソート */}
      <div className="flex items-center gap-2 flex-wrap">
        <DarkPill
          label="すべての目的"
          active={!currentParams.purpose}
          onClick={() => updateParam('purpose', '')}
          small
        />
        {PURPOSES.map((p) => (
          <DarkPill
            key={p}
            label={p}
            active={currentParams.purpose === p}
            onClick={() => toggleParam('purpose', p)}
            small
          />
        ))}

        {/* ソートトグル */}
        <div
          className="ml-auto flex items-center gap-0.5 rounded-lg p-0.5 shrink-0"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <SortBtn
            label="新着順"
            active={currentSort !== 'score'}
            onClick={() => updateParam('sort', '')}
          />
          <SortBtn
            label="スコア順"
            active={currentSort === 'score'}
            onClick={() => updateParam('sort', 'score')}
          />
        </div>
      </div>

      {/* アクティブフィルタータグ */}
      {(currentParams.industry || currentParams.purpose) && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">絞り込み中:</span>
          {currentParams.industry && (
            <ActiveTag label={currentParams.industry} onRemove={() => updateParam('industry', '')} />
          )}
          {currentParams.purpose && (
            <ActiveTag label={currentParams.purpose} onRemove={() => updateParam('purpose', '')} />
          )}
          <button
            onClick={() => router.push('/')}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors ml-1"
          >
            クリア
          </button>
        </div>
      )}
    </div>
  )
}

function DarkPill({
  label,
  active,
  onClick,
  small = false,
}: {
  label: string
  active: boolean
  onClick: () => void
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full font-medium transition-all ${
        small ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'
      }`}
      style={
        active
          ? {
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              border: '1px solid transparent',
            }
          : {
              background: 'rgba(255,255,255,0.05)',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.08)',
            }
      }
    >
      {label}
    </button>
  )
}

function SortBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
      style={
        active
          ? {
              background: 'rgba(255,255,255,0.1)',
              color: '#f1f5f9',
            }
          : {
              background: 'transparent',
              color: '#64748b',
            }
      }
    >
      {label}
    </button>
  )
}

function ActiveTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: 'rgba(99,102,241,0.15)',
        color: '#818cf8',
        border: '1px solid rgba(99,102,241,0.25)',
      }}
    >
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors leading-none ml-0.5">
        ×
      </button>
    </span>
  )
}
