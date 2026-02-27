import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'

export async function GET() {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient({ requireServiceRole: true })
  const { data, error } = await supabase
    .from('lp_collection_sources')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sources: data ?? [] })
}

export async function POST(request: NextRequest) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, type, config, active } = body

  if (!name || !type) return NextResponse.json({ error: 'name and type are required' }, { status: 400 })

  const supabase = createServiceClient({ requireServiceRole: true })
  const { data, error } = await supabase
    .from('lp_collection_sources')
    .insert({ name, type, config: config ?? {}, active: active ?? true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ source: data })
}
