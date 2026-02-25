import { createServiceClient } from '@/lib/supabase'
import type { LPWithAnalysis } from '@/types'
import { Header } from '@/components/public/header'
import { LPCard } from '@/components/public/lp-card'
import { SearchForm } from '@/components/public/search-form'

export const dynamic = 'force-dynamic'

async function searchLPs(query: string): Promise<LPWithAnalysis[]> {
  if (!query.trim()) return []

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('lps')
    .select('*, lp_analyses(*)')
    .eq('status', 'active')
    .or(`title.ilike.%${query}%,industry.ilike.%${query}%,purpose.ilike.%${query}%,target_audience.ilike.%${query}%`)
    .limit(20)

  return (data as LPWithAnalysis[]) ?? []
}

export const metadata = {
  title: '検索',
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const query = searchParams.q ?? ''
  const results = await searchLPs(query)

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="max-w-2xl mx-auto text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] mb-3">LP検索</h1>
          <p className="text-sm text-[#767b74] mb-6">業界・目的・キーワードからLPを検索</p>
          <SearchForm initialQuery={query} />
        </div>

        {query && (
          <div className="mt-8">
            {results.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto w-20 h-20 rounded-3xl flex items-center justify-center mb-5 bg-white border border-[#d9dbd6]">
                  <svg className="w-8 h-8 text-[#8a8f88]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-[#323632] font-medium mb-1">
                  「{query}」に一致するLPが見つかりませんでした
                </p>
                <p className="text-sm text-[#767b74]">
                  別のキーワードで検索してみてください
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-[#767b74]">
                    「<span className="text-[#111111] font-medium">{query}</span>」の検索結果: {results.length}件
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" style={{ gridAutoRows: '280px' }}>
                  {results.map((lp) => (
                    <div key={lp.id}>
                      <LPCard lp={lp} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {!query && (
          <div className="text-center py-12">
            <p className="text-[#767b74] text-sm">キーワードを入力して検索してください</p>
          </div>
        )}
      </div>
    </div>
  )
}
