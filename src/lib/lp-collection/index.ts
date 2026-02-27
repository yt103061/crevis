/**
 * LP収集アルゴリズム v2 統合モジュール
 *
 * 収集フロー（優先度順）:
 * 1. SerpAPI Google Search Ads → 直接LP URL（最高品質、課金あり）
 * 2. robots.txt Disallow probe → 隠しLP発掘（無料）
 * 3. Wayback CDX domain expansion → 過去LP URL（無料）
 * 4. ギャラリーシード → sankoudesign/muuuuu.org 等から外部LP収集（無料）
 *
 * 各候補は既存の scoreLpHtml + AI分析に通す（変更なし）。
 */

import { probeLPsFromRobotsTxt } from './robots-probe'
import { discoverLPsFromWayback, getUrlLongevity } from './wayback-cdx'
import { discoverFromGoogleSearchAds } from './serpapi-discovery'
import { scrapeBoxilDomains } from './boxil-scraper'
import { analyzeLP } from '@/lib/ai-client'
import { createServiceClient } from '@/lib/supabase'

export interface AdvancedDiscoveryResult {
  layer: string
  discovered: number
  inserted: number
  activated: number
  errors: number
}

// 業界キーワード（SerpAPI Google Search Ads用）
// 100個あれば100回無料枠を使い切れる
const JP_INDUSTRY_KEYWORDS = [
  // 税務・会計
  '税理士 転職', '会計ソフト 無料', 'クラウド会計 比較', '確定申告 ソフト',
  // HR・採用
  '採用管理 ツール', '人事評価 クラウド', '勤怠管理 無料', '採用 ATS 比較',
  // マーケティング
  'MAツール 比較', 'CRM ツール 無料', 'メール配信 サービス',
  // 不動産・金融
  '不動産投資 セミナー', '資産運用 無料相談', 'ローン 比較',
  // SaaS全般
  'プロジェクト管理 ツール', 'チャットツール 比較', 'ビジネスチャット 無料',
]

export async function runAdvancedLPDiscovery(options: {
  enableSerpAPI?: boolean
  enableRobotsProbe?: boolean
  enableWayback?: boolean
  enableBoxil?: boolean
  enableGallerySeed?: boolean
  maxNewPerRun?: number
  minScore?: number
} = {}): Promise<AdvancedDiscoveryResult[]> {
  const {
    enableSerpAPI = !!process.env.SERPAPI_KEY,
    enableRobotsProbe = true,
    enableWayback = true,
    enableGallerySeed = true,
    maxNewPerRun = 10,
    minScore = 70,
  } = options

  const supabase = createServiceClient({ requireServiceRole: true })
  const results: AdvancedDiscoveryResult[] = []
  let totalInserted = 0

  // ヘルパー: URL候補をDBに登録 + AI分析
  // 返り値: 'activated'（スコア合格・公開）| 'inserted'（登録のみ）| false（スキップ/失敗）
  async function processCandidate(candidate: {
    url: string
    discoverySource: string
    adDaysActive?: number
    advertiserId?: string
    adKeywords?: string[]
    hasNoindex?: boolean
  }): Promise<'activated' | 'inserted' | false> {
    if (totalInserted >= maxNewPerRun) return false

    // 重複チェック
    const { data: existing } = await supabase
      .from('lps')
      .select('id')
      .eq('url', candidate.url)
      .maybeSingle()
    if (existing) return false

    // HTML取得 + noindex確認
    let html = ''
    try {
      const res = await fetch(candidate.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0)' },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      })
      if (!res.ok) return false
      html = await res.text()
    } catch { return false }

    // noindex検出
    const hasNoIndex = /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) ||
      candidate.hasNoindex === true

    // Waybackで稼働日数補完
    let daysActive = candidate.adDaysActive ?? 30
    if (!candidate.adDaysActive) {
      const longevity = await getUrlLongevity(candidate.url)
      daysActive = longevity.daysActive
    }

    // DB挿入
    const { data: lp, error } = await supabase
      .from('lps')
      .insert({
        url: candidate.url,
        status: 'archived',
        discovery_source: candidate.discoverySource,
        ad_days_active: daysActive > 0 ? daysActive : null,
        advertiser_id: candidate.advertiserId ?? null,
        ad_keywords: candidate.adKeywords ?? null,
        has_noindex: hasNoIndex,
      })
      .select()
      .single()

    if (error || !lp) return false
    totalInserted++

    // AI分析
    try {
      const analysis = await analyzeLP({
        url: candidate.url,
        industry: '不明',
        purpose: '不明',
        target_audience: '不明',
        days_active: daysActive,
        rawHtml: html,
      })

      const { inferred_industry, inferred_purpose, inferred_target_audience, ...analysisData } = analysis

      await supabase.from('lp_analyses').insert({
        lp_id: lp.id,
        ...analysisData,
      })

      const shouldActivate = (analysis.total_score ?? 0) >= minScore
      await supabase.from('lps').update({
        status: shouldActivate ? 'active' : 'archived',
        last_checked_at: new Date().toISOString(),
        ...(inferred_industry ? { industry: inferred_industry } : {}),
        ...(inferred_purpose ? { purpose: inferred_purpose } : {}),
        ...(inferred_target_audience ? { target_audience: inferred_target_audience } : {}),
      }).eq('id', lp.id)

      return shouldActivate ? 'activated' : 'inserted'
    } catch {
      return 'inserted'
    }
  }

  // --- Layer 1: SerpAPI Google Search Ads ---
  if (enableSerpAPI) {
    const layerResult: AdvancedDiscoveryResult = { layer: 'serpapi_search', discovered: 0, inserted: 0, activated: 0, errors: 0 }

    // 1日3〜4キーワードで無料枠100回/月をコントロール
    const todayIndex = new Date().getDate() % JP_INDUSTRY_KEYWORDS.length
    const keywordsToday = JP_INDUSTRY_KEYWORDS.slice(todayIndex, todayIndex + 4)

    for (const keyword of keywordsToday) {
      if (totalInserted >= maxNewPerRun) break
      try {
        const candidates = await discoverFromGoogleSearchAds(keyword)
        layerResult.discovered += candidates.length

        for (const c of candidates) {
          if (totalInserted >= maxNewPerRun) break
          const r = await processCandidate({
            url: c.url,
            discoverySource: 'serpapi_search',
            adKeywords: c.keywords,
            adDaysActive: c.daysActive,
            advertiserId: c.advertiserId,
          })
          if (r === 'activated') { layerResult.activated++; layerResult.inserted++ }
          else if (r === 'inserted') { layerResult.inserted++ }
          await new Promise(res => setTimeout(res, 500))
        }
      } catch { layerResult.errors++ }
    }
    results.push(layerResult)
  }

  // --- Layer 2: robots.txt probe ---
  if (enableRobotsProbe) {
    const layerResult: AdvancedDiscoveryResult = { layer: 'robots_probe', discovered: 0, inserted: 0, activated: 0, errors: 0 }

    // BOXILから取得したドメイン群に対してprobeする
    const saasProducts = await scrapeBoxilDomains(20)
    for (const product of saasProducts) {
      if (totalInserted >= maxNewPerRun) break
      try {
        const probedLPs = await probeLPsFromRobotsTxt(product.domain)
        layerResult.discovered += probedLPs.length
        for (const lp of probedLPs.slice(0, 3)) {
          if (totalInserted >= maxNewPerRun) break
          const r = await processCandidate({
            url: lp.url,
            discoverySource: 'robots_txt',
          })
          if (r === 'activated') { layerResult.activated++; layerResult.inserted++ }
          else if (r === 'inserted') { layerResult.inserted++ }
          await new Promise(res => setTimeout(res, 500))
        }
      } catch { layerResult.errors++ }
      await new Promise(res => setTimeout(res, 1000))
    }
    results.push(layerResult)
  }

  // --- Layer 3: Wayback CDX ---
  if (enableWayback) {
    const layerResult: AdvancedDiscoveryResult = { layer: 'wayback_cdx', discovered: 0, inserted: 0, activated: 0, errors: 0 }

    // 既存DBにある active LP のドメインを起点にWaybackで関連LP発掘
    const { data: existingLPs } = await supabase
      .from('lps')
      .select('url')
      .eq('status', 'active')
      .limit(10)

    if (existingLPs) {
      for (const existing of existingLPs) {
        if (totalInserted >= maxNewPerRun) break
        try {
          const domain = new URL(existing.url).hostname.replace(/^www\./, '')
          const waybackLPs = await discoverLPsFromWayback(domain)
          layerResult.discovered += waybackLPs.length
          for (const wlp of waybackLPs.slice(0, 2)) {
            if (totalInserted >= maxNewPerRun) break
            const r = await processCandidate({
              url: wlp.url,
              discoverySource: 'wayback_cdx',
              adDaysActive: wlp.daysActive,
            })
            if (r === 'activated') { layerResult.activated++; layerResult.inserted++ }
            else if (r === 'inserted') { layerResult.inserted++ }
          }
        } catch { layerResult.errors++ }
      }
    }
    results.push(layerResult)
  }

  // --- Layer 4: Gallery Seed ---
  if (enableGallerySeed) {
    const layerResult: AdvancedDiscoveryResult = { layer: 'gallery_seed', discovered: 0, inserted: 0, activated: 0, errors: 0 }
    try {
      const { scrapeGallerySeedLPs } = await import('./gallery-seed')
      const seeds = await scrapeGallerySeedLPs(30)
      layerResult.discovered = seeds.length

      for (const seed of seeds) {
        if (totalInserted >= maxNewPerRun) break
        try {
          const r = await processCandidate({
            url: seed.url,
            discoverySource: `gallery_seed:${seed.sourceGallery}`,
          })
          if (r === 'activated') { layerResult.activated++; layerResult.inserted++ }
          else if (r === 'inserted') { layerResult.inserted++ }
          await new Promise(res => setTimeout(res, 500))
        } catch { layerResult.errors++ }
      }
    } catch { layerResult.errors++ }
    results.push(layerResult)
  }

  return results
}
