import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const ids: string[] = Array.isArray(body.ids) ? body.ids : []
  const action: 'accept' | 'reject' = body.action
  if (!ids.length || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceClient({ requireServiceRole: true })
  const status = action === 'accept' ? 'accepted' : 'rejected'
  const { error } = await supabase.from('lp_candidates').update({ status, reviewed_at: new Date().toISOString() }).in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ updated: ids.length, status })
}
