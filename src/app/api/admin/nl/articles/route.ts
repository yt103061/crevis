import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 200)

  const supabase = createServiceClient({ requireServiceRole: true })

  let query = supabase
    .from('nl_articles')
    .select('*')
    .order('relevance_score', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ articles: data ?? [] })
}
