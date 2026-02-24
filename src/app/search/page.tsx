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
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.08) 0%, transparent 60%), #07070f',
      }}
    >
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="max-w-2xl mx-auto text-center mb-8 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-3">LP検索</h1>
          <p className="text-sm text-slate-400 mb-6">業界・目的・キーワードからLPを検索</p>
          <SearchForm initialQuery={query} />
        </div>

        {query && (
          <div className="mt-8 animate-fade-in-up stagger-1">
            {results.length === 0 ? (
              <div className="text-center py-16">
                <div
                  className="mx-auto w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-slate-400 font-medium mb-1">
                  「{query}」に一致するLPが見つかりませんでした
                </p>
                <p className="text-sm text-slate-600">
                  別のキーワードで検索してみてください
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-500">
                    「<span className="text-slate-300">{query}</span>」の検索結果: {results.length}件
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" style={{ gridAutoRows: '280px' }}>
                  {results.map((lp, i) => (
                    <div key={lp.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                      <LPCard lp={lp} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {!query && (
          <div className="text-center py-12 animate-fade-in">
            <p className="text-slate-500 text-sm">キーワードを入力して検索してください</p>
          </div>
        )}
      </div>
    </div>
  )
}
