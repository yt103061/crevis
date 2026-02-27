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

  if (srcErr) {
    console.error('[Collect] ソース取得エラー:', srcErr.message)
    return NextResponse.json({ error: srcErr.message }, { status: 500 })
  }

  console.log('[Collect] === LP収集開始 ===')
  console.log('[Collect] アクティブなギャラリーソース:', sources?.length ?? 0, '件',
    sources?.map((s) => s.name) ?? [])

  if (!sources?.length) {
    console.log('[Collect] ソースが0件のため終了')
    return NextResponse.json({
      message: 'No active gallery sources',
      newCandidates: 0,
      autoAccepted: 0,
      debug: { sourcesTotal: 0, urlFilterPassed: 0, dedupPassed: 0, candidatesInserted: 0, autoApproved: 0 },
    })
  }

  // 既存URL一覧をキャッシュ
  const { data: existingCandidates } = await supabase.from('lp_candidates').select('url')
  const { data: existingLPs } = await supabase.from('lps').select('url')
  const existingUrls = new Set<string>([
    ...(existingCandidates ?? []).map((r) => r.url),
    ...(existingLPs ?? []).map((r) => r.url),
  ])
  console.log('[Collect] 既存URL数 (重複チェック用):', existingUrls.size, '件')

  let totalNew = 0
  let totalAutoAccepted = 0
  let totalCollectedRaw = 0
  let totalInsertFailed = 0
  const sourceErrors: string[] = []

  const sourceDebug: Record<string, { collected: number; inserted: number; autoAccepted: number; insertErrors: number }> = {}

  for (const source of sources) {
    console.log(`\n[Collect] --- ソース: ${source.name} ---`)
    try {
      const config = source.config as {
        base_url: string
        list_selector: string
        link_selector: string
        pagination?: string
        max_pages?: number
      }
      console.log('[Collect] Config:', JSON.stringify({ base_url: config.base_url, list_selector: config.list_selector, link_selector: config.link_selector }))

      const collected = await collectFromGallery(config, existingUrls)
      totalCollectedRaw += collected.length

      console.log(`[Collect] collectFromGallery 結果: ${collected.length}件`)
      if (collected.length > 0) {
        console.log('[Collect] サンプルURL (先頭5件):',
          collected.slice(0, 5).map((c) => c.url))
      } else {
        console.log('[Collect] 収集URLが0件 - ソースの設定(list_selector/link_selector)を確認してください')
      }

      sourceDebug[source.name] = { collected: collected.length, inserted: 0, autoAccepted: 0, insertErrors: 0 }

      let srcInserted = 0
      let srcAutoAccepted = 0
      let srcInsertErrors = 0

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
          } else {
            console.log(`[Collect] HTML取得失敗 (${res.status}): ${candidate.url}`)
          }
        } catch (fetchErr) {
          console.log(`[Collect] HTML取得例外: ${candidate.url}`, fetchErr instanceof Error ? fetchErr.message : fetchErr)
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
          srcInserted++
          existingUrls.add(candidate.url)
          if (status === 'auto_accepted') {
            totalAutoAccepted++
            srcAutoAccepted++
          }
        } else {
          srcInsertErrors++
          totalInsertFailed++
          // 重複エラー(23505)は通常の動作なので WARN のみ
          if (insertErr.code === '23505') {
            console.log(`[Collect] 重複スキップ: ${candidate.url}`)
          } else {
            console.error(`[Collect] INSERT失敗 (${insertErr.code}): ${candidate.url}`, insertErr.message)
          }
        }
      }

      sourceDebug[source.name] = { collected: collected.length, inserted: srcInserted, autoAccepted: srcAutoAccepted, insertErrors: srcInsertErrors }
      console.log(`[Collect] ソース ${source.name} 完了: 収集${collected.length}件 → 登録${srcInserted}件 (自動承認${srcAutoAccepted}件, 失敗${srcInsertErrors}件)`)

      // 最終取得日時を更新
      await supabase
        .from('lp_collection_sources')
        .update({ last_fetched_at: new Date().toISOString(), total_collected: (source.total_collected ?? 0) + collected.length })
        .eq('id', source.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error(`[Collect] ソース ${source.name} 例外:`, err)
      sourceErrors.push(`${source.name}: ${msg}`)
    }
  }

  console.log(`\n[Collect] === 収集完了 ===`)
  console.log(`[Collect] ソース数: ${sources.length} / 総収集: ${totalCollectedRaw} / 新規登録: ${totalNew} / 自動承認: ${totalAutoAccepted} / INSERT失敗: ${totalInsertFailed}`)
  console.log('[Collect] ソース別:', JSON.stringify(sourceDebug, null, 2))

  const debug = {
    sourcesTotal: sources.length,
    urlsCollectedRaw: totalCollectedRaw,
    candidatesInserted: totalNew,
    autoApproved: totalAutoAccepted,
    insertFailed: totalInsertFailed,
    sourceDetail: sourceDebug,
  }

  return NextResponse.json({
    newCandidates: totalNew,
    autoAccepted: totalAutoAccepted,
    sourceErrors,
    debug,
  })
}
