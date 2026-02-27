import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { ids, action } = body as { ids: string[]; action: 'approve' | 'reject' | 'pending' }

  if (!ids?.length || !['approve', 'reject', 'pending'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const statusMap: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    pending: 'pending',
  }

  const supabase = createServiceClient({ requireServiceRole: true })
  const { error } = await supabase
    .from('nl_articles')
    .update({ status: statusMap[action], reviewed_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: ids.length })
}
