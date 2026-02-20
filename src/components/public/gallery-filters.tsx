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
    <div className="space-y-3 mb-6">
      {/* 業界フィルター（横スクロール） */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        <Pill
          label="すべて"
          active={!currentParams.industry}
          onClick={() => updateParam('industry', '')}
        />
        {INDUSTRIES.map((i) => (
          <Pill
            key={i}
            label={i}
            active={currentParams.industry === i}
            onClick={() => toggleParam('industry', i)}
          />
        ))}
      </div>

      {/* 目的フィルター + ソート */}
      <div className="flex items-center gap-2 flex-wrap">
        <Pill
          label="すべての目的"
          active={!currentParams.purpose}
          onClick={() => updateParam('purpose', '')}
          small
        />
        {PURPOSES.map((p) => (
          <Pill
            key={p}
            label={p}
            active={currentParams.purpose === p}
            onClick={() => toggleParam('purpose', p)}
            small
          />
        ))}

        {/* ソート切替 */}
        <div className="ml-auto flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => updateParam('sort', '')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentSort !== 'score'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            新着順
          </button>
          <button
            onClick={() => updateParam('sort', 'score')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentSort === 'score'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            スコア順
          </button>
        </div>
      </div>

      {/* アクティブフィルター表示 */}
      {(currentParams.industry || currentParams.purpose) && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">絞り込み中:</span>
          {currentParams.industry && (
            <ActiveTag label={currentParams.industry} onRemove={() => updateParam('industry', '')} />
          )}
          {currentParams.purpose && (
            <ActiveTag label={currentParams.purpose} onRemove={() => updateParam('purpose', '')} />
          )}
          <button
            onClick={() => router.push('/')}
            className="text-xs text-gray-400 hover:text-gray-600 ml-1"
          >
            すべてクリア
          </button>
        </div>
      )}
    </div>
  )
}

function Pill({
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
      className={`shrink-0 rounded-full border font-medium transition-all ${
        small ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'
      } ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
      }`}
    >
      {label}
    </button>
  )
}

function ActiveTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-indigo-900 leading-none ml-0.5">
        ×
      </button>
    </span>
  )
}
