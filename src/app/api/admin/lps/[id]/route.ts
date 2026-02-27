import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { analyzeLP } from '@/lib/ai-client'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient({ requireServiceRole: true })
  const { data: lp, error } = await supabase
    .from('lps')
    .select('*, lp_analyses(*)')
    .eq('id', params.id)
    .single()

  if (error || !lp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ページ特徴データを取得
  const { data: features } = await supabase
    .from('lp_page_features')
    .select('*')
    .eq('lp_id', params.id)
    .maybeSingle()

  return NextResponse.json({ lp, features })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient({ requireServiceRole: true })
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

    const createdAt = lp.first_seen_at ?? lp.created_at ?? new Date().toISOString()
    const daysActive = Math.max(
      0,
      Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
    )

    let result
    try {
      result = await analyzeLP({
        url: lp.url,
        industry: lp.industry ?? '不明',
        purpose: lp.purpose ?? '不明',
        target_audience: lp.target_audience ?? '不明',
        days_active: daysActive,
      })
    } catch (aiErr) {
      console.error('[reanalyze] AI分析エラー:', aiErr)
      return NextResponse.json(
        { error: 'AI分析に失敗しました', detail: aiErr instanceof Error ? aiErr.message : String(aiErr) },
        { status: 500 }
      )
    }

    // 既存分析を削除して新規保存
    await supabase.from('lp_analyses').delete().eq('lp_id', params.id)
    const { data: analysis, error: insertErr } = await supabase
      .from('lp_analyses')
      .insert({ lp_id: params.id, ...result })
      .select()
      .single()

    if (insertErr) {
      console.error('[reanalyze] DB保存エラー:', insertErr)
      return NextResponse.json({ error: 'DB保存に失敗しました', detail: insertErr.message }, { status: 500 })
    }

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

  const supabase = createServiceClient({ requireServiceRole: true })
  const { error } = await supabase.from('lps').delete().eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
