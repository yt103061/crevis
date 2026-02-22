'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="業界・目的・キーワードで検索..."
          className="input-dark pl-12 pr-24 py-3.5 rounded-2xl text-base"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-2 px-5 text-sm"
        >
          検索
        </button>
      </div>
    </form>
  )
}
