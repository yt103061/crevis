import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { runNewsletterFetch } from '@/lib/newsletter/fetch'
import { autoApprovePendingArticles, createIssueFromApprovedArticles } from '@/lib/newsletter/issue-automation'

function hasAutomationSecret(request: NextRequest) {
  const secret = process.env.AUTOMATION_CRON_SECRET
  if (!secret) return false

  const bearer = request.headers.get('authorization')
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null
  const headerSecret = request.headers.get('x-automation-secret')
  return token === secret || headerSecret === secret
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminAuth()
  const trustedCron = hasAutomationSecret(request)

  if (!admin && !trustedCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as {
    autoApproveThreshold?: number
  }

  const autoApproveThreshold = Math.min(Math.max(body.autoApproveThreshold ?? 70, 0), 100)

  try {
    const fetchResults = await runNewsletterFetch()
    const autoApproved = await autoApprovePendingArticles(autoApproveThreshold)
    const issueDraft = await createIssueFromApprovedArticles()

    return NextResponse.json({
      ok: true,
      fetchResults,
      autoApproved,
      issueDraft,
    })
  } catch (error) {
    console.error('Automation run failed:', error)
    return NextResponse.json({ error: 'Automation run failed' }, { status: 500 })
  }
}
