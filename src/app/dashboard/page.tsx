import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import type { LPWithAnalysis, Collection } from '@/types'
import { Header } from '@/components/public/header'
import { LPCard } from '@/components/public/lp-card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface CollectionWithLP extends Collection {
  lps: LPWithAnalysis
}

export const metadata = {
  title: 'コレクション',
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login?redirect=/dashboard')
  }

  const supabase = createServiceClient()
  const { data: collections } = await supabase
    .from('collections')
    .select('*, lps(*, lp_analyses(*))')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  const items = (collections as CollectionWithLP[]) ?? []

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">コレクション</h1>
            <p className="text-sm text-[#767b74] mt-1">保存したLPを一覧で確認</p>
          </div>
          <span className="text-sm font-medium px-3 py-1.5 rounded-xl bg-white border border-[#d9dbd6] text-[#5e625c]">
            {items.length}件
          </span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="mx-auto w-20 h-20 rounded-3xl flex items-center justify-center mb-5 bg-white border border-[#d9dbd6]">
              <svg className="w-9 h-9 text-[#8a8f88]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <p className="text-[#323632] font-medium mb-2">コレクションはまだありません</p>
            <p className="text-sm text-[#767b74] mb-6">気になるLPをブックマークして、後から参照できます</p>
            <Link href="/" className="btn-primary">
              LPを探す
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" style={{ gridAutoRows: '280px' }}>
            {items.map((item) => (
              <div key={item.id}>
                <LPCard lp={item.lps} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
