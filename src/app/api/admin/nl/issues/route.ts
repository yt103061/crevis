import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'

export async function GET() {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient({ requireServiceRole: true })
  const { data, error } = await supabase
    .from('newsletter_issues')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ issues: data ?? [] })
}

export async function POST(request: NextRequest) {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { title, featured_lps, featured_articles } = body

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const supabase = createServiceClient({ requireServiceRole: true })

  // 号番号を自動採番
  const { data: lastIssue } = await supabase
    .from('newsletter_issues')
    .select('issue_number')
    .order('issue_number', { ascending: false })
    .limit(1)
    .single()

  const issueNumber = (lastIssue?.issue_number ?? 0) + 1

  // HTML生成
  const contentHtml = generateIssueHTML(title, issueNumber, featured_articles ?? [])

  const { data, error } = await supabase
    .from('newsletter_issues')
    .insert({
      issue_number: issueNumber,
      title,
      content_html: contentHtml,
      featured_lps: featured_lps ?? [],
      featured_articles: featured_articles ?? [],
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ issue: data })
}

function generateIssueHTML(
  title: string,
  issueNumber: number,
  articleIds: string[]
): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <header style="border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #6366f1; font-size: 24px; margin: 0;">CreVis Newsletter</h1>
    <p style="color: #666; margin: 4px 0 0;">第${issueNumber}号 - ${title}</p>
  </header>
  <main>
    <p>今週のCRO・LP設計の知見をお届けします。</p>
    <!-- 記事コンテンツはここに挿入されます -->
    ${articleIds.map((id) => `<!-- article:${id} -->`).join('\n')}
  </main>
  <footer style="border-top: 1px solid #eee; padding-top: 16px; margin-top: 32px; color: #999; font-size: 12px;">
    <p>CreVis - 成果の出るLPを発見するAIネイティブプラットフォーム</p>
    <p><a href="{{unsubscribe_url}}" style="color: #999;">配信停止はこちら</a></p>
  </footer>
</body>
</html>`
}
