import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { lp_id, memo } = body

  if (!lp_id) {
    return NextResponse.json({ error: 'lp_id is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('collections')
    .insert({ user_id: session.user.id, lp_id, memo })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '既にコレクションに追加済みです' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ collection: data })
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const lpId = searchParams.get('lp_id')

  if (!lpId) {
    return NextResponse.json({ error: 'lp_id is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('user_id', session.user.id)
    .eq('lp_id', lpId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
