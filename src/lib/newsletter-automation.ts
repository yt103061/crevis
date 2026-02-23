import RSSParser from 'rss-parser'
import { processNewsletterArticle } from '@/lib/ai-client'
import { createServiceClient } from '@/lib/supabase'

const parser = new RSSParser({ timeout: 10000 })

export interface FetchResult {
  processed: number
  skipped: number
  errors: number
}

export async function fetchArticlesFromSources(limitPerSource = 10): Promise<FetchResult> {
  const supabase = createServiceClient()
  const { data: sources, error: sourcesError } = await supabase
    .from('nl_sources')
    .select('*')
    .eq('active', true)

  if (sourcesError || !sources?.length) {
    throw new Error('No active sources found')
  }

  const results: FetchResult = { processed: 0, skipped: 0, errors: 0 }

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url)
      const items = feed.items.slice(0, limitPerSource)

      for (const item of items) {
        if (!item.link) continue

        const { data: existing } = await supabase
          .from('nl_articles')
          .select('id')
          .eq('original_url', item.link)
          .single()

        if (existing) {
          results.skipped++
          continue
        }

        const content = item.contentSnippet ?? item.content ?? item.summary ?? ''

        let aiResult
        try {
          aiResult = await processNewsletterArticle({
            original_title: item.title ?? '',
            original_content: content,
          })
        } catch (aiError) {
          console.error('AI processing failed for:', item.link, aiError)
          results.errors++
          continue
        }

        const { error: insertError } = await supabase.from('nl_articles').insert({
          source_id: source.id,
          original_url: item.link,
          original_title: item.title ?? '',
          original_content: content.slice(0, 5000),
          summary_ja: aiResult.summary_ja,
          translated_title_ja: aiResult.translated_title_ja,
          key_insights: aiResult.key_insights,
          relevance_score: aiResult.relevance_score,
          status: 'pending',
        })

        if (insertError) {
          console.error('Failed to insert article:', insertError)
          results.errors++
        } else {
          results.processed++
        }
      }

      await supabase
        .from('nl_sources')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', source.id)
    } catch (sourceError) {
      console.error(`Failed to fetch source ${source.name}:`, sourceError)
      results.errors++
    }
  }

  return results
}

export async function autoApprovePendingArticles(scoreThreshold = 75): Promise<number> {
  const supabase = createServiceClient()

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

interface BuildIssueOptions {
  title?: string
  minApprovedArticles?: number
  articleLimit?: number
  force?: boolean
}

export async function createWeeklyIssueDraftFromApproved(
  options: BuildIssueOptions = {}
): Promise<{ created: boolean; issueId?: string; reason?: string; articleCount: number }> {
  const {
    title,
    minApprovedArticles = 3,
    articleLimit = 5,
    force = false,
  } = options

  const supabase = createServiceClient()

  if (!force) {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)

    const { data: recentDraft } = await supabase
      .from('newsletter_issues')
      .select('id')
      .eq('status', 'draft')
      .gte('created_at', weekStart.toISOString())
      .limit(1)
      .single()

    if (recentDraft) {
      return { created: false, reason: 'recent_draft_exists', articleCount: 0 }
    }
  }

  const { data: approvedArticles, error: approvedError } = await supabase
    .from('nl_articles')
    .select('id, translated_title_ja, original_title, summary_ja, original_url, relevance_score')
    .eq('status', 'approved')
    .order('relevance_score', { ascending: false })
    .order('fetched_at', { ascending: false })
    .limit(articleLimit)

  if (approvedError) {
    console.error('Failed to fetch approved articles:', approvedError)
    return { created: false, reason: 'approved_query_error', articleCount: 0 }
  }

  if (!approvedArticles || approvedArticles.length < minApprovedArticles) {
    return {
      created: false,
      reason: 'not_enough_approved_articles',
      articleCount: approvedArticles?.length ?? 0,
    }
  }

  const { data: lastIssue } = await supabase
    .from('newsletter_issues')
    .select('issue_number')
    .order('issue_number', { ascending: false })
    .limit(1)
    .single()

  const issueNumber = (lastIssue?.issue_number ?? 0) + 1
  const generatedTitle =
    title ?? `${new Date().toLocaleDateString('ja-JP')}週のCRO/LPインサイトまとめ`

  const contentHtml = generateIssueHTML(generatedTitle, issueNumber, approvedArticles)

  const { data: issue, error: insertError } = await supabase
    .from('newsletter_issues')
    .insert({
      issue_number: issueNumber,
      title: generatedTitle,
      content_html: contentHtml,
      featured_lps: [],
      featured_articles: approvedArticles.map((a) => a.id),
      status: 'draft',
    })
    .select('id')
    .single()

  if (insertError || !issue) {
    console.error('Failed to create issue draft:', insertError)
    return { created: false, reason: 'issue_insert_failed', articleCount: approvedArticles.length }
  }

  return { created: true, issueId: issue.id, articleCount: approvedArticles.length }
}

function generateIssueHTML(
  title: string,
  issueNumber: number,
  articles: Array<{
    id: string
    translated_title_ja: string | null
    original_title: string
    summary_ja: string | null
    original_url: string
    relevance_score: number | null
  }>
): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.65;">
  <header style="border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #6366f1; font-size: 24px; margin: 0;">CreVis Newsletter</h1>
    <p style="color: #666; margin: 4px 0 0;">第${issueNumber}号 - ${title}</p>
  </header>
  <main>
    <p>今週のCRO・LP設計の知見をお届けします。実務に活かせる要点を短くまとめました。</p>
    ${articles
      .map(
        (article, index) => `<section style="margin-top: 22px; padding-top: 12px; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #666; margin: 0 0 6px;">記事 ${index + 1} / 関連度 ${article.relevance_score ?? '-'}</p>
      <h2 style="font-size: 18px; margin: 0 0 8px; color: #111;">${article.translated_title_ja ?? article.original_title}</h2>
      <p style="margin: 0 0 10px; color: #444;">${article.summary_ja ?? '要約を準備中です。'}</p>
      <p style="margin: 0;"><a href="${article.original_url}" target="_blank" rel="noopener noreferrer" style="color: #4f46e5;">元記事を読む</a></p>
      <!-- article:${article.id} -->
    </section>`
      )
      .join('')}
  </main>
  <footer style="border-top: 1px solid #eee; padding-top: 16px; margin-top: 32px; color: #999; font-size: 12px;">
    <p>CreVis - 成果の出るLPを発見するAIネイティブプラットフォーム</p>
    <p><a href="{{unsubscribe_url}}" style="color: #999;">配信停止はこちら</a></p>
  </footer>
</body>
</html>`
}
