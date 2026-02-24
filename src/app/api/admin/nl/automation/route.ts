import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import {
  autoApprovePendingArticles,
  createWeeklyIssueDraftFromApproved,
  fetchArticlesFromSources,
} from '@/lib/newsletter-automation'

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
    fetchLimitPerSource?: number
    autoApproveThreshold?: number
    minApprovedArticles?: number
    issueArticleLimit?: number
    forceCreateIssue?: boolean
  }

  const fetchLimitPerSource = Math.min(Math.max(body.fetchLimitPerSource ?? 10, 1), 30)
  const autoApproveThreshold = Math.min(Math.max(body.autoApproveThreshold ?? 75, 0), 100)
  const minApprovedArticles = Math.min(Math.max(body.minApprovedArticles ?? 3, 1), 10)
  const issueArticleLimit = Math.min(Math.max(body.issueArticleLimit ?? 5, 1), 10)

  try {
    const fetchResults = await fetchArticlesFromSources(fetchLimitPerSource)
    const autoApproved = await autoApprovePendingArticles(autoApproveThreshold)
    const issueDraft = await createWeeklyIssueDraftFromApproved({
      minApprovedArticles,
      articleLimit: issueArticleLimit,
      force: !!body.forceCreateIssue,
    })

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
