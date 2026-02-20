import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { Resend } from 'resend'

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
  const supabase = createServiceClient()

  if (action === 'send') {
    // メール配信
    const { data: issue } = await supabase
      .from('newsletter_issues')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    if (issue.status === 'sent') {
      return NextResponse.json({ error: 'Already sent' }, { status: 400 })
    }

    // アクティブな購読者を取得
    const { data: subscribers } = await supabase
      .from('newsletter_subscribers')
      .select('email')
      .is('unsubscribed_at', null)

    if (!subscribers?.length) {
      return NextResponse.json({ error: 'No subscribers' }, { status: 400 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromEmail = process.env.RESEND_FROM_EMAIL!

    let sentCount = 0
    // バッチ送信（100件ずつ）
    for (let i = 0; i < subscribers.length; i += 100) {
      const batch = subscribers.slice(i, i + 100)
      try {
        await resend.batch.send(
          batch.map((sub) => ({
            from: fromEmail,
            to: sub.email,
            subject: `[CreVis] ${issue.title}`,
            html: issue.content_html ?? '',
          }))
        )
        sentCount += batch.length
      } catch (sendError) {
        console.error('Batch send error:', sendError)
      }
    }

    // ステータス更新
    const { data, error } = await supabase
      .from('newsletter_issues')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        recipient_count: sentCount,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ issue: data, sentCount })
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
