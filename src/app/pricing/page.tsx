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
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.1) 0%, transparent 60%), #07070f',
      }}
    >
      <Header />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center mb-12 animate-fade-in-up">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4">
            プラン<span className="text-gradient">・料金</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto">
            Freeプランで始めて、必要に応じてアップグレード
          </p>
        </div>

        <PricingCards currentPlan={currentPlan} isLoggedIn={!!session} />
      </div>
    </div>
  )
}
