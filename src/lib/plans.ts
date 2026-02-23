import { createServiceClient } from '@/lib/supabase'

export type Plan = 'free' | 'pro' | 'team'

const FREE_LP_VIEW_LIMIT = 20

export async function getUserPlan(userId: string): Promise<Plan> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()
  return (data?.plan as Plan) ?? 'free'
}

export function canViewFullAnalysis(plan: Plan): boolean {
  return plan === 'pro' || plan === 'team'
}

export function getLPViewLimit(plan: Plan): number {
  return plan === 'free' ? FREE_LP_VIEW_LIMIT : Infinity
}

export function canUseSemanticSearch(plan: Plan): boolean {
  return plan === 'pro' || plan === 'team'
}
