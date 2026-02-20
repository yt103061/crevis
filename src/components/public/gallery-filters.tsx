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

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {/* 業界フィルター */}
      <select
        value={currentParams.industry ?? ''}
        onChange={(e) => updateParam('industry', e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">業界: すべて</option>
        {INDUSTRIES.map((i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>

      {/* 目的フィルター */}
      <select
        value={currentParams.purpose ?? ''}
        onChange={(e) => updateParam('purpose', e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">目的: すべて</option>
        {PURPOSES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* ソート */}
      <select
        value={currentParams.sort ?? 'newest'}
        onChange={(e) => updateParam('sort', e.target.value === 'newest' ? '' : e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="newest">新着順</option>
        <option value="score">スコア順</option>
      </select>

      {/* クリアボタン */}
      {(currentParams.industry || currentParams.purpose || currentParams.sort) && (
        <button
          onClick={() => router.push('/')}
          className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-2"
        >
          フィルターをクリア
        </button>
      )}
    </div>
  )
}
