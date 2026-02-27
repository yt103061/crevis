import { NextRequest, NextResponse } from 'next/server'
import { runAdvancedLPDiscovery } from '@/lib/lp-collection'

export const maxDuration = 300 // 5分

export async function GET(request: NextRequest) {
  // Vercel Cron または管理画面からの呼び出しを認証
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = request.headers.get('authorization')
    // Vercel Cron からは Bearer <CRON_SECRET> で来る。不一致は拒否
    // 管理画面からの直接呼び出し（auth headerなし）は許可 — admin layoutで保護済み
    if (authHeader && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const results = await runAdvancedLPDiscovery({
      enableSerpAPI: !!process.env.SERPAPI_KEY,
      enableRobotsProbe: true,
      enableWayback: true,
      enableBoxil: true,
      enableGallerySeed: true,
      maxNewPerRun: 10,
    })
    return NextResponse.json({ ok: true, results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
