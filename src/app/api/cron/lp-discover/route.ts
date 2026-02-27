import { NextRequest, NextResponse } from 'next/server'
import { runDiscoveryPipeline } from '@/lib/lp-discovery/pipeline'

function verifyAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : request.nextUrl.searchParams.get('token')

  return token === cronSecret
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 })
  }
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await runDiscoveryPipeline()
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discovery pipeline failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 })
  }
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await runDiscoveryPipeline()
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discovery pipeline failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export const preferredRegion = 'hnd1'
