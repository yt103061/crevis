import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { collectFromGallery } from '@/lib/lp-collector'
import { analyzeLpHtml } from '@/lib/lp-analyzer'
import { fetchExternal } from '@/lib/http-client'

export async function POST() {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient({ requireServiceRole: true })

  // 全activeギャラリーソースを取得
  const { data: sources, error: srcErr } = await supabase
    .from('lp_collection_sources')
    .select('*')
    .eq('active', true)
    .eq('type', 'gallery')

  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 })
  if (!sources?.length) return NextResponse.json({ message: 'No active gallery sources', newCandidates: 0, autoAccepted: 0 })

  // 既存URL一覧をキャッシュ
  const { data: existingCandidates } = await supabase.from('lp_candidates').select('url')
  const { data: existingLPs } = await supabase.from('lps').select('url')
  const existingUrls = new Set<string>([
    ...(existingCandidates ?? []).map((r) => r.url),
    ...(existingLPs ?? []).map((r) => r.url),
  ])

  let totalNew = 0
  let totalAutoAccepted = 0
  const sourceErrors: string[] = []

  for (const source of sources) {
    try {
      const config = source.config as {
        base_url: string
        list_selector: string
        link_selector: string
        pagination?: string
        max_pages?: number
      }

      const collected = await collectFromGallery(config, existingUrls)

      for (const candidate of collected) {
        // LP判定スコア算出
        let lpConfidenceScore: number | null = null
        let isLikelyLP: boolean | null = null
        let pageTitle = candidate.pageTitle

        try {
          const res = await fetchExternal(candidate.url, { timeoutMs: 10000, maxRatePerMinute: 5 })
          if (res.ok) {
            const html = await res.text()
            const features = analyzeLpHtml(html, candidate.url)
            // ギャラリー経由は人間選別済みなので+20加算
            lpConfidenceScore = Math.min(100, features.lpConfidenceScore + 20)
            isLikelyLP = lpConfidenceScore >= 40
            if (!pageTitle && features.metaTitle) pageTitle = features.metaTitle
          }
        } catch {
          // フォールバック: スコアなし
        }

        const status = lpConfidenceScore !== null && lpConfidenceScore >= 70
          ? 'auto_accepted'
          : 'new'

        const { error: insertErr } = await supabase.from('lp_candidates').insert({
          url: candidate.url,
          source_type: 'gallery_scrape',
          source_name: source.name,
          lp_confidence_score: lpConfidenceScore,
          is_likely_lp: isLikelyLP,
          page_title: pageTitle,
          page_domain: candidate.pageDomain,
          status,
        }).single()

        if (!insertErr) {
          totalNew++
          existingUrls.add(candidate.url)
          if (status === 'auto_accepted') totalAutoAccepted++
        }
      }

      // 最終取得日時を更新
      await supabase
        .from('lp_collection_sources')
        .update({ last_fetched_at: new Date().toISOString(), total_collected: (source.total_collected ?? 0) + collected.length })
        .eq('id', source.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error(`Source ${source.name} failed:`, err)
      sourceErrors.push(`${source.name}: ${msg}`)
    }
  }

  return NextResponse.json({
    newCandidates: totalNew,
    autoAccepted: totalAutoAccepted,
    sourceErrors,
  })
}
