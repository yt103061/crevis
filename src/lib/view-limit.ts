import { createServiceClient } from '@/lib/supabase'
import type { PlanType } from '@/types'

export const FREE_VIEW_LIMIT = 20

function startOfCurrentMonth(): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

// 当月のユニークLP閲覧数を返す
export async function getMonthlyViewCount(userId: string): Promise<number> {
  const supabase = createServiceClient({ requireServiceRole: true })
  const { count, error } = await supabase
    .from('lp_view_counts')
    .select('lp_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('viewed_at', startOfCurrentMonth())

  if (error) {
    console.error('getMonthlyViewCount error:', error)
    return 0
  }
  return count ?? 0
}

// 閲覧記録を追加（同じLPは二重登録しない）
export async function recordView(userId: string, lpId: string): Promise<void> {
  const supabase = createServiceClient({ requireServiceRole: true })
  const { error } = await supabase
    .from('lp_view_counts')
    .upsert({ user_id: userId, lp_id: lpId }, { onConflict: 'user_id,lp_id', ignoreDuplicates: true })

  if (error) {
    console.error('recordView error:', error)
  }
}

// LP閲覧が許可されているか判定
// Pro/Team は無制限、Free/Reader は当月 20件まで
export async function canViewLP(userId: string, plan: PlanType): Promise<boolean> {
  if (plan === 'pro' || plan === 'team') return true
  const count = await getMonthlyViewCount(userId)
  return count < FREE_VIEW_LIMIT
}
