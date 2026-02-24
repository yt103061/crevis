import { NextRequest, NextResponse } from 'next/server'
import { runNewsletterIssueAutomation } from '@/lib/newsletter/issue-automation'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const tokenFromHeader = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null
  const tokenFromQuery = request.nextUrl.searchParams.get('token')
  const token = tokenFromHeader ?? tokenFromQuery

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runNewsletterIssueAutomation()
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Automation failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export const preferredRegion = 'hnd1'
