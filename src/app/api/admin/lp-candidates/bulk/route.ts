import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { ids, action } = body as { ids: string[]; action: 'accept' | 'reject' }

  if (!ids?.length || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceClient({ requireServiceRole: true })
  let success = 0
  let failed = 0

  for (const id of ids) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/admin/lp-candidates/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') ?? '' },
          body: JSON.stringify({ action }),
        }
      )
      if (res.ok) success++
      else failed++
    } catch {
      failed++
    }
  }

  // acceptの場合は一括却下のみSupabaseで直接処理（高速化のため）
  if (action === 'reject' && ids.length > 0) {
    await supabase
      .from('lp_candidates')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .in('id', ids)
    return NextResponse.json({ success: ids.length, failed: 0 })
  }

  return NextResponse.json({ success, failed })
}

// LP候補リスト取得
export async function GET(request: NextRequest) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? ''

  const supabase = createServiceClient({ requireServiceRole: true })
  let query = supabase
    .from('lp_candidates')
    .select('*')
    .order('discovered_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ candidates: data ?? [] })
}
