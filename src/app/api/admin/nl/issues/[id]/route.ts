import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { sendIssue } from '@/lib/newsletter/issue-automation'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient({ requireServiceRole: true })
  const { data: issue, error } = await supabase
    .from('newsletter_issues')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !issue) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // featured_articles のIDから記事詳細を取得
  let articles: unknown[] = []
  if (issue.featured_articles?.length) {
    const { data } = await supabase
      .from('nl_articles')
      .select('id, original_title, translated_title_ja, summary_ja, original_url, relevance_score, status')
      .in('id', issue.featured_articles)
    articles = data ?? []
  }

  return NextResponse.json({ issue, articles })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient({ requireServiceRole: true })
  const { error } = await supabase.from('newsletter_issues').delete().eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action, ...fields } = body
  const supabase = createServiceClient({ requireServiceRole: true })

  if (action === 'send') {
    try {
      const result = await sendIssue(params.id)
      return NextResponse.json({ sentCount: result.sentCount, alreadySent: result.alreadySent })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Send failed'
      const status = message === 'Issue not found' ? 404 : message === 'No subscribers' ? 400 : 500
      return NextResponse.json({ error: message }, { status })
    }
  }

  // 通常の更新
  const { data, error } = await supabase
    .from('newsletter_issues')
    .update(fields)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ issue: data })
}
