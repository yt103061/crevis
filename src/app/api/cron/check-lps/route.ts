import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: lps } = await supabase
    .from('lps')
    .select('id, url, last_checked_at')
    .eq('status', 'active')
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(10)

  if (!lps?.length) {
    return NextResponse.json({ message: 'No LPs to check', checked: 0 })
  }

  let checked = 0
  let deactivated = 0

  for (const lp of lps) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const res = await fetch(lp.url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      })

      clearTimeout(timeout)

      if (res.status >= 400) {
        await supabase
          .from('lps')
          .update({ status: 'archived', last_checked_at: new Date().toISOString() })
          .eq('id', lp.id)
        deactivated++
      } else {
        await supabase
          .from('lps')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', lp.id)
      }
      checked++
    } catch {
      await supabase
        .from('lps')
        .update({ last_checked_at: new Date().toISOString() })
        .eq('id', lp.id)
      checked++
    }
  }

  return NextResponse.json({ checked, deactivated })
}
