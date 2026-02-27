import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

interface TakedownBody {
  reason?: string
  email?: string
  name?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient()
  let body: TakedownBody = {}
  try { body = await request.json() } catch { /* optional body */ }

  const { id } = params

  // LPの存在確認
  const { data: lp } = await supabase
    .from('lps')
    .select('id, title, url, status')
    .eq('id', id)
    .maybeSingle()

  if (!lp) return NextResponse.json({ error: 'LP not found' }, { status: 404 })
  if (lp.status === 'takedown') {
    return NextResponse.json({ error: '既に削除申請済みです' }, { status: 409 })
  }

  // takedown_requestsに記録
  const { error: insertError } = await supabase
    .from('takedown_requests')
    .insert({
      lp_id: id,
      reason: body.reason ?? null,
      requester_email: body.email ?? null,
      requester_name: body.name ?? null,
      status: 'pending',
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // LPステータスをtakedownに変更
  const { error: updateError } = await supabase
    .from('lps')
    .update({ status: 'takedown' })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: '削除申請を受け付けました' })
}
