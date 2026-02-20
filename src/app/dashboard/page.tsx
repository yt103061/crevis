import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import type { LPWithAnalysis, Collection } from '@/types'
import { Header } from '@/components/public/header'
import { LPCard } from '@/components/public/lp-card'

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
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">コレクション</h1>
          <span className="text-sm text-gray-500">{items.length}件保存済み</span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">コレクションはまだありません</p>
            <a
              href="/"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
            >
              LPを探す
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((item) => (
              <LPCard key={item.id} lp={item.lps} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
