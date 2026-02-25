import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { getSourceQualityMetrics, type SourceQualityMetrics } from '@/lib/newsletter/source-metrics'

export async function GET() {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient({ requireServiceRole: true })
  const [{ data, error }, metrics] = await Promise.all([
    supabase.from('nl_sources').select('*').order('created_at', { ascending: false }),
    getSourceQualityMetrics(),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const metricsMap = new Map(metrics.map((m: SourceQualityMetrics) => [m.source_id, m]))
  const sourcesWithMetrics = (data ?? []).map((s: Record<string, unknown>) => ({
    ...s,
    metrics: metricsMap.get(s.id) ?? null,
  }))

  return NextResponse.json({ sources: sourcesWithMetrics })
}

export async function POST(request: NextRequest) {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, url, type, language } = body

  if (!name || !url) {
    return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 })
  }

  const supabase = createServiceClient({ requireServiceRole: true })
  const { data, error } = await supabase
    .from('nl_sources')
    .insert({ name, url, type: type ?? 'rss', language: language ?? 'en' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ source: data })
}
