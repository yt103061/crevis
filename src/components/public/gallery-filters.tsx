'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const INDUSTRIES = ['SaaS', 'EC', '教育', 'BtoB', '美容', '医療', '金融']
const PURPOSES = ['CV獲得', '資料請求', '無料登録', '購入', '問い合わせ']

export function GalleryFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentParams = useMemo(
    () => ({
      industry: searchParams.get('industry') ?? '',
      purpose: searchParams.get('purpose') ?? '',
      sort: searchParams.get('sort') ?? '',
    }),
    [searchParams]
  )

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!value) params.delete(key)
      else params.set(key, value)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
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
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <Pill label="すべて" active={!currentParams.industry} onClick={() => updateParam('industry', '')} />
        {INDUSTRIES.map((i) => (
          <Pill key={i} label={i} active={currentParams.industry === i} onClick={() => toggleParam('industry', i)} />
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Pill label="すべての目的" active={!currentParams.purpose} onClick={() => updateParam('purpose', '')} small />
        {PURPOSES.map((p) => (
          <Pill key={p} label={p} active={currentParams.purpose === p} onClick={() => toggleParam('purpose', p)} small />
        ))}

        <div className="ml-auto flex items-center gap-0.5 rounded-md p-0.5 shrink-0 bg-white border border-[#d9dbd6]">
          <SortBtn label="新着順" active={currentSort !== 'score'} onClick={() => updateParam('sort', '')} />
          <SortBtn label="スコア順" active={currentSort === 'score'} onClick={() => updateParam('sort', 'score')} />
        </div>
      </div>

      {(currentParams.industry || currentParams.purpose) && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#767b74]">絞り込み中:</span>
          {currentParams.industry && <ActiveTag label={currentParams.industry} onRemove={() => updateParam('industry', '')} />}
          {currentParams.purpose && <ActiveTag label={currentParams.purpose} onRemove={() => updateParam('purpose', '')} />}
          <button onClick={() => router.replace('/', { scroll: false })} className="text-xs text-[#767b74] hover:text-[#111] transition-colors ml-1">
            クリア
          </button>
        </div>
      )}
    </div>
  )
}

function Pill({ label, active, onClick, small = false }: { label: string; active: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full font-medium transition-colors border ${small ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} ${
        active ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#5e625c] border-[#d9dbd6] hover:bg-[#f1f1ee]'
      }`}
    >
      {label}
    </button>
  )
}

function SortBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
        active ? 'bg-[#111] text-white' : 'bg-transparent text-[#767b74]'
      }`}
    >
      {label}
    </button>
  )
}

function ActiveTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#eef2ff] text-[#1d4ed8] border border-[#c7d2fe]">
      {label}
      <button onClick={onRemove} className="hover:text-[#111] transition-colors leading-none ml-0.5">
        ×
      </button>
    </span>
  )
}
