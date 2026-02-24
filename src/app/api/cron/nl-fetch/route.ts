import { NextRequest, NextResponse } from 'next/server'
import { runNewsletterFetch } from '@/lib/newsletter/fetch'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : request.nextUrl.searchParams.get('token')

  if (token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await runNewsletterFetch()
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fetch failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export const preferredRegion = 'nrt1'
