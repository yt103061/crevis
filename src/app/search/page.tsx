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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const query = searchParams.q ?? ''
  const results = await searchLPs(query)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">LP検索</h1>

        <SearchForm initialQuery={query} />

        {query && (
          <div className="mt-6">
            {results.length === 0 ? (
              <p className="text-gray-500">
                「{query}」に一致するLPが見つかりませんでした
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  「{query}」の検索結果: {results.length}件
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {results.map((lp) => (
                    <LPCard key={lp.id} lp={lp} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
