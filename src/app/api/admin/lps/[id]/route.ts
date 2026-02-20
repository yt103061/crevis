import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { analyzeLP } from '@/lib/ai-client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const body = await request.json()
  const { action, ...fields } = body

  if (action === 'reanalyze') {
    // LP情報取得
    const { data: lp } = await supabase
      .from('lps')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!lp) {
      return NextResponse.json({ error: 'LP not found' }, { status: 404 })
    }

    const firstSeen = new Date(lp.first_seen_at)
    const daysActive = Math.floor(
      (Date.now() - firstSeen.getTime()) / (1000 * 60 * 60 * 24)
    )

    const result = await analyzeLP({
      url: lp.url,
      industry: lp.industry ?? '不明',
      purpose: lp.purpose ?? '不明',
      target_audience: lp.target_audience ?? '不明',
      days_active: daysActive,
    })

    // 既存分析を削除して新規保存
    await supabase.from('lp_analyses').delete().eq('lp_id', params.id)
    const { data: analysis } = await supabase
      .from('lp_analyses')
      .insert({ lp_id: params.id, ...result })
      .select()
      .single()

    return NextResponse.json({ analysis })
  }

  // ステータス更新など
  const { data, error } = await supabase
    .from('lps')
    .update(fields)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ lp: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('lps').delete().eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
