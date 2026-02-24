import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { runLPDiscovery } from '@/lib/lp-discovery'

export async function POST() {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await runLPDiscovery()
    return NextResponse.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discovery failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
