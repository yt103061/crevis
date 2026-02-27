import { NextResponse } from 'next/server'
import { runAdvancedLPDiscovery } from '@/lib/lp-collection'

export const maxDuration = 300 // 5分

export async function GET() {
  try {
    const results = await runAdvancedLPDiscovery({
      enableSerpAPI: !!process.env.SERPAPI_KEY,
      enableRobotsProbe: true,
      enableWayback: true,
      enableBoxil: true,
      maxNewPerRun: 10,
    })
    return NextResponse.json({ ok: true, results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
