import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email } = body

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: '有効なメールアドレスを入力してください' }, { status: 400 })
  }

  const supabase = createServiceClient({ requireServiceRole: true })

  // 既存チェック（退会済みなら再登録）
  const { data: existing } = await supabase
    .from('newsletter_subscribers')
    .select('*')
    .eq('email', email)
    .single()

  if (existing) {
    if (existing.unsubscribed_at) {
      // 再登録
      await supabase
        .from('newsletter_subscribers')
        .update({ unsubscribed_at: null, subscribed_at: new Date().toISOString() })
        .eq('id', existing.id)
      return NextResponse.json({ message: '購読を再開しました' })
    }
    return NextResponse.json({ message: '既に購読登録済みです' })
  }

  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email })

  if (error) {
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ message: '購読登録が完了しました' })
}
