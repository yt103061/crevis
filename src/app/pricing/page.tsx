import { Header } from '@/components/public/header'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { PricingCards } from './pricing-cards'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'プラン・料金',
}

export default async function PricingPage() {
  const session = await getSession()
  let currentPlan = 'free'

  if (session?.user) {
    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', session.user.id)
      .single()
    currentPlan = profile?.plan ?? 'free'
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <Header />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-5 border border-[#d9dbd6] bg-white">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1d4ed8]" />
            <span className="text-xs font-semibold text-[#1d4ed8]">プラン・料金</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#111111] mb-4">
            Freeプランで始めて、<br className="hidden sm:block" />必要に応じてアップグレード
          </h1>
          <p className="text-sm sm:text-base text-[#5e625c] max-w-lg mx-auto">
            無料でLPギャラリーと週刊ニュースレターを利用できます
          </p>
        </div>

        <PricingCards currentPlan={currentPlan} isLoggedIn={!!session} />
      </div>
    </div>
  )
}
