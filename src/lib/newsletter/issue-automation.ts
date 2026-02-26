import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase'

interface NLArticleRow {
  id: string
  original_url: string
  translated_title_ja: string | null
  original_title: string
  summary_ja: string | null
  relevance_score: number | null
  key_insights: string[] | null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderArticle(article: NLArticleRow): string {
  const title = escapeHtml(article.translated_title_ja ?? article.original_title)
  const summary = escapeHtml(article.summary_ja ?? '要約未設定')
  const insights = (article.key_insights ?? []).slice(0, 3)

  return `
    <article style="margin: 0 0 24px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="font-size: 18px; margin: 0 0 8px; color: #111827;">${title}</h2>
      <p style="font-size: 14px; color: #4b5563; line-height: 1.7; margin: 0 0 10px;">${summary}</p>
      ${insights.length > 0 ? `<ul style="margin: 0 0 10px; padding-left: 20px; color: #374151; font-size: 13px;">${insights.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''}
      <a href="${article.original_url}" style="font-size: 13px; color: #4f46e5;">元記事を見る</a>
    </article>
  `
}

function generateIssueHTML(title: string, issueNumber: number, articles: NLArticleRow[]): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 680px; margin: 0 auto; padding: 20px; color: #111827; background: #fff;">
  <header style="border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #6366f1; font-size: 24px; margin: 0;">CreVis Newsletter</h1>
    <p style="color: #6b7280; margin: 4px 0 0;">第${issueNumber}号 - ${escapeHtml(title)}</p>
  </header>
  <main>
    <p style="font-size: 14px; color: #4b5563; line-height: 1.7;">今週のCRO・LP設計の知見をお届けします。</p>
    ${articles.map((a) => renderArticle(a)).join('')}
  </main>
  <footer style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 32px; color: #9ca3af; font-size: 12px;">
    <p>CreVis - 成果の出るLPを発見するAIネイティブプラットフォーム</p>
    <p><a href="{{unsubscribe_url}}" style="color: #9ca3af;">配信停止はこちら</a></p>
  </footer>
</body>
</html>`
}

export async function autoApprovePendingArticles(scoreThreshold = 70): Promise<number> {
  const supabase = createServiceClient({ requireServiceRole: true })

  const { data: candidates, error } = await supabase
    .from('nl_articles')
    .select('id, relevance_score')
    .eq('status', 'pending')
    .gte('relevance_score', scoreThreshold)

  if (error || !candidates?.length) {
    if (error) console.error('Auto-approve query error:', error)
    return 0
  }

  const ids = candidates.map((a) => a.id)
  const { error: updateError } = await supabase
    .from('nl_articles')
    .update({ status: 'approved' })
    .in('id', ids)

  if (updateError) {
    console.error('Auto-approve update error:', updateError)
    return 0
  }

  return ids.length
}

export async function createIssueFromApprovedArticles() {
  const supabase = createServiceClient({ requireServiceRole: true })

  const { data: existingIssue } = await supabase
    .from('newsletter_issues')
    .select('id, status')
    .in('status', ['draft', 'ready'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingIssue) {
    return { created: false, reason: 'draft_or_ready_issue_exists' as const }
  }

  const minRelevance = Number(process.env.NL_AUTO_MIN_RELEVANCE ?? '70')
  const articleCount = Number(process.env.NL_AUTO_ARTICLE_COUNT ?? '5')

  const { data: approvedArticles } = await supabase
    .from('nl_articles')
    .select('id, original_url, translated_title_ja, original_title, summary_ja, relevance_score, key_insights')
    .eq('status', 'approved')
    .gte('relevance_score', minRelevance)
    .order('relevance_score', { ascending: false })
    .limit(articleCount)

  const articles = (approvedArticles ?? []) as NLArticleRow[]
  if (articles.length < articleCount) {
    return {
      created: false,
      reason: 'not_enough_approved_articles' as const,
      required: articleCount,
      available: articles.length,
    }
  }

  const { data: lastIssue } = await supabase
    .from('newsletter_issues')
    .select('issue_number')
    .order('issue_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const issueNumber = (lastIssue?.issue_number ?? 0) + 1
  const title = `週刊LPインサイト #${issueNumber}`

  const issueHtml = generateIssueHTML(title, issueNumber, articles)

  const { data: issue, error } = await supabase
    .from('newsletter_issues')
    .insert({
      issue_number: issueNumber,
      title,
      content_html: issueHtml,
      featured_articles: articles.map((a) => a.id),
      featured_lps: [],
      status: 'ready',
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    created: true,
    issue,
  }
}

function generateFreeHtml(title: string, issueNumber: number, firstArticle: NLArticleRow | undefined, issueUrl: string): string {
  const articleHtml = firstArticle ? renderArticle(firstArticle) : ''
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 680px; margin: 0 auto; padding: 20px; color: #111827; background: #fff;">
  <header style="border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #1d4ed8; font-size: 24px; margin: 0;">CreVis Newsletter</h1>
    <p style="color: #6b7280; margin: 4px 0 0;">第${issueNumber}号 - ${escapeHtml(title)}</p>
  </header>
  <main>
    <p style="font-size: 14px; color: #4b5563; line-height: 1.7;">今週のCRO・LP設計の知見をお届けします。</p>
    ${articleHtml}
    <div style="margin: 24px 0; padding: 20px; background: #eef2ff; border-radius: 12px; text-align: center;">
      <p style="font-size: 15px; font-weight: bold; color: #111827; margin: 0 0 8px;">続きはReaderプランで読めます</p>
      <p style="font-size: 13px; color: #4b5563; margin: 0 0 16px;">今号はあと${issueNumber > 1 ? '複数' : ''}記事掲載しています。Key Insights・Actionable Tipsを含む全文はReaderプラン（月額¥500）でどうぞ。</p>
      <a href="${issueUrl}" style="display: inline-block; padding: 10px 24px; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold;">全文を読む</a>
    </div>
  </main>
  <footer style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 32px; color: #9ca3af; font-size: 12px;">
    <p>CreVis - 成果の出るLPを発見するAIネイティブプラットフォーム</p>
    <p><a href="{{unsubscribe_url}}" style="color: #9ca3af;">配信停止はこちら</a></p>
  </footer>
</body>
</html>`
}

export async function sendIssue(issueId: string) {
  const supabase = createServiceClient({ requireServiceRole: true })

  const { data: issue } = await supabase
    .from('newsletter_issues')
    .select('*')
    .eq('id', issueId)
    .single()

  if (!issue) {
    throw new Error('Issue not found')
  }

  if (issue.status === 'sent') {
    return { alreadySent: true, sentCount: issue.recipient_count ?? 0 }
  }

  const { data: subscribers } = await supabase
    .from('newsletter_subscribers')
    .select('email')
    .is('unsubscribed_at', null)

  if (!subscribers?.length) {
    throw new Error('No subscribers')
  }

  // Fetch paid plan emails from profiles to differentiate sending
  const subscriberEmails = subscribers.map((s) => s.email)
  const { data: paidProfiles } = await supabase
    .from('profiles')
    .select('email, plan')
    .in('email', subscriberEmails)
    .in('plan', ['reader', 'pro', 'team'])

  const paidEmailSet = new Set((paidProfiles ?? []).map((p) => p.email).filter(Boolean))

  // Build the free-tier teaser HTML
  const featuredArticleIds: string[] = issue.featured_articles ?? []
  let firstArticle: NLArticleRow | undefined
  if (featuredArticleIds.length > 0) {
    const { data: articleRows } = await supabase
      .from('nl_articles')
      .select('id, original_url, translated_title_ja, original_title, summary_ja, relevance_score, key_insights')
      .eq('id', featuredArticleIds[0])
      .maybeSingle()
    firstArticle = articleRows as NLArticleRow | undefined
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crevis.jp'
  const issueUrl = `${appUrl}/newsletter/${issue.issue_number}`
  const freeHtml = generateFreeHtml(issue.title, issue.issue_number, firstArticle, issueUrl)
  const fullHtml = issue.content_html ?? freeHtml

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!fromEmail) {
    throw new Error('RESEND_FROM_EMAIL is not configured')
  }

  let sentCount = 0
  for (let i = 0; i < subscribers.length; i += 100) {
    const batch = subscribers.slice(i, i + 100)
    try {
      await resend.batch.send(
        batch.map((sub) => ({
          from: fromEmail,
          to: sub.email,
          subject: `[CreVis] ${issue.title}`,
          html: paidEmailSet.has(sub.email) ? fullHtml : freeHtml,
        }))
      )
      sentCount += batch.length
    } catch (error) {
      console.error('Batch send error:', error)
    }
  }

  const { error: updateError } = await supabase
    .from('newsletter_issues')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipient_count: sentCount,
    })
    .eq('id', issue.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return { alreadySent: false, sentCount }
}

export async function runNewsletterIssueAutomation() {
  const minRelevanceForApprove = Number(process.env.NL_AUTO_MIN_RELEVANCE ?? '70')
  await autoApprovePendingArticles(minRelevanceForApprove)

  const created = await createIssueFromApprovedArticles()

  if (!created.created) {
    return {
      ...created,
      sent: false,
      sentCount: 0,
    }
  }

  const shouldAutoSend = String(process.env.NL_AUTO_SEND ?? 'false').toLowerCase() === 'true'
  if (!shouldAutoSend) {
    return {
      created: true,
      issueId: created.issue.id,
      sent: false,
      sentCount: 0,
    }
  }

  const sent = await sendIssue(created.issue.id)
  return {
    created: true,
    issueId: created.issue.id,
    sent: !sent.alreadySent,
    sentCount: sent.sentCount,
  }
}
