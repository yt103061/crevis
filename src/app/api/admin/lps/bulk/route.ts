import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

type BulkAction = 'delete' | 'deactivate' | 'reset_screenshot'

interface BulkRequestBody {
  action: BulkAction
  ids: string[]
}

export async function POST(request: NextRequest) {
  const user = await requireAdminAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: BulkRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, ids } = body

  if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'action と ids は必須です' }, { status: 400 })
  }

  if (!['delete', 'deactivate', 'reset_screenshot'].includes(action)) {
    return NextResponse.json({ error: '無効な action です' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (action === 'delete') {
    const { error } = await supabase.from('lps').delete().in('id', ids)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, affected: ids.length })
  }

  if (action === 'deactivate') {
    const { error } = await supabase
      .from('lps')
      .update({ status: 'inactive' })
      .in('id', ids)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, affected: ids.length })
  }

  if (action === 'reset_screenshot') {
    const { error } = await supabase
      .from('lps')
      .update({ screenshot_url: null })
      .in('id', ids)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, affected: ids.length })
  }

  return NextResponse.json({ error: '処理できませんでした' }, { status: 500 })
}
