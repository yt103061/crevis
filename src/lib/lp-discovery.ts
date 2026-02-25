import RSSParser from 'rss-parser'
import { analyzeLP } from '@/lib/ai-client'
import { createServiceClient } from '@/lib/supabase'
import { DEFAULT_LP_DISCOVERY_FEEDS, type LPDiscoveryFeed } from '@/lib/automation/default-feeds'

const parser = new RSSParser({
  timeout: 10000,
  customFields: {
    item: ['content:encoded'],
  },
})

export interface LPDiscoveryResult {
  discovered: number
  inserted: number
  analyzed: number
  activated: number
  skipped: number
  heuristic_skipped: number
  errors: number
  feed_errors: number
  feed_error_details: string[]
}

interface Candidate {
  url: string
  title?: string
  sourceName: string
  sourceWeight: number
  market: 'jp' | 'global'
}

function getFeedDefinitions(): LPDiscoveryFeed[] {
  const raw = process.env.LP_DISCOVERY_FEEDS ?? ''
  const feedsFromEnv = raw
    .split(',')
    .map((url) => url.trim())
    .filter((url) => !!url)

  if (feedsFromEnv.length > 0) {
    return feedsFromEnv.map((url) => {
      let host = 'custom'
      try {
        host = new URL(url).hostname
      } catch {
        host = 'custom'
      }
      return {
        name: `env:${host}`,
        url,
        type: 'direct' as const,
        market: 'jp' as const,
        weight: 20,
      }
    })
  }

  const allowDefaults = String(process.env.LP_DISCOVERY_USE_DEFAULT_FEEDS ?? 'true').toLowerCase() === 'true'
  return allowDefaults ? DEFAULT_LP_DISCOVERY_FEEDS : []
}

function normalizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.hash = ''

    const filtered = new URLSearchParams()
    url.searchParams.forEach((value, key) => {
      if (key.startsWith('utm_')) return
      if (key === 'fbclid' || key === 'gclid') return
      filtered.append(key, value)
    })
    url.search = filtered.toString() ? `?${filtered.toString()}` : ''

    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function isJapaneseCandidate(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('.jp') || parsed.pathname.includes('/jp/')
  } catch {
    return false
  }
}

function containsLpIntentKeyword(text: string): boolean {
  const s = text.toLowerCase()
  const keywords = ['lp', 'landing', 'campaign', 'trial', 'signup', 'register', 'contact', 'form', '資料請求', '申し込み', '申込', '無料', '導入', 'キャンペーン']
  return keywords.some((k) => s.includes(k))
}

function containsPerformanceSignal(text: string): boolean {
  const s = text.toLowerCase()
  const keywords = [
    'cvr',
    'cv',
    'roas',
    'roi',
    '売上',
    '成約',
    '導入実績',
    '利用社数',
    '累計',
    '達成',
    '改善',
    '成果',
    '実績',
    '比較',
    '事例',
  ]
  return keywords.some((k) => s.includes(k))
}

function heuristicScore(candidate: Candidate): number {
  let score = candidate.sourceWeight
  if (isJapaneseCandidate(candidate.url)) score += 24

  if (containsLpIntentKeyword(candidate.url)) score += 18
  if (candidate.title && containsLpIntentKeyword(candidate.title)) score += 16

  if (containsPerformanceSignal(candidate.url)) score += 10
  if (candidate.title && containsPerformanceSignal(candidate.title)) score += 16

  if (candidate.market === 'jp') score += 12
  if (candidate.url.includes('/lp') || candidate.url.includes('/campaign')) score += 8

  return score
}

/**
 * B3: LP候補のHTMLを取得し、「本当にLPか」スコアを算出する。
 * フォーム・CTA要素を加点、ブログ記事的なシグナルを減点。
 * スコアが低い候補はAI分析前にスキップし、AI呼び出しコストと精度を最適化する。
 */
function scoreLpHtml(html: string): number {
  let score = 0
  const lower = html.toLowerCase()

  // フォーム・入力要素（高スコア）
  if (/<form[\s>]/i.test(html)) score += 30
  if (/<input[^>]+type=["']email["']/i.test(html)) score += 20
  if (/<input[^>]+type=["']submit["']/i.test(html)) score += 15

  // CTA系キーワード
  const ctaKeywords = [
    '申し込み', '資料請求', '無料', '登録', 'お問い合わせ', '今すぐ', '試す', 'ダウンロード',
    'trial', 'sign up', 'get started', 'contact', 'free', 'download', 'register', 'demo',
  ]
  const ctaHits = ctaKeywords.filter((k) => lower.includes(k)).length
  score += ctaHits * 8

  // ブログ記事・ニュースページ的シグナル（減点）
  if (/<article[\s>]/i.test(html) && /<time[\s>]/i.test(html)) score -= 25
  const articleCount = (html.match(/<article[\s>]/gi) ?? []).length
  if (articleCount > 3) score -= 20

  return score
}

/** LPページのHTMLをGETで取得する。失敗時はnullを返す。 */
async function fetchLpHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0; +https://crevis.jp)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function extractLinksFromHtml(html: string): string[] {
  const links: string[] = []
  const regex = /href=["']([^"']+)["']/g
  let match
  while ((match = regex.exec(html)) !== null) {
    links.push(match[1])
  }
  return links
}



async function fetchFeedWithFallback(feed: LPDiscoveryFeed) {
  try {
    return await parser.parseURL(feed.url)
  } catch (primaryError) {
    try {
      const res = await fetch(feed.url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0; +https://crevis.jp)',
          accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const raw = await res.text()
      return await parser.parseString(raw)
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : 'unknown_feed_error'
      const primaryMessage = primaryError instanceof Error ? primaryError.message : 'unknown_primary_error'
      throw new Error(`${feed.name}: ${message} (primary: ${primaryMessage})`)
    }
  }
}

async function extractCandidatesFromIntermediary(itemLink: string, feed: LPDiscoveryFeed): Promise<string[]> {
  try {
    const res = await fetch(itemLink, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const html = await res.text()

    // フィード自身のドメインへのリンクを除外（例: producthunt.com → producthunt.comリンクを除く）
    let feedHost = ''
    try {
      feedHost = new URL(feed.url).hostname.replace(/^www\./, '')
    } catch {
      feedHost = ''
    }

    const base = new URL(itemLink)
    const rawLinks = extractLinksFromHtml(html)
    const normalized = rawLinks
      .map((href) => {
        try {
          return new URL(href, base).toString()
        } catch {
          return null
        }
      })
      .filter((u): u is string => !!u)
      .map((u) => normalizeUrl(u))
      .filter((u): u is string => !!u)
      .filter((u) => !u.includes('prtimes.jp'))
      .filter((u) => !u.includes('twitter.com') && !u.includes('x.com') && !u.includes('facebook.com') && !u.includes('instagram.com') && !u.includes('linkedin.com') && !u.includes('youtube.com'))
      .filter((u) => {
        if (!feedHost) return true
        try {
          return !new URL(u).hostname.replace(/^www\./, '').endsWith(feedHost)
        } catch {
          return true
        }
      })

    // 重複が多いのでユニーク化
    return Array.from(new Set(normalized))
  } catch (error) {
    console.error('Intermediary extraction failed:', feed.name, itemLink, error)
    return []
  }
}

async function collectCandidates(feed: LPDiscoveryFeed, item: { link?: string; title?: string }): Promise<Candidate[]> {
  if (!item.link) return []

  const candidates: Candidate[] = []
  if (feed.type === 'direct') {
    const normalized = normalizeUrl(item.link)
    if (!normalized) return []
    candidates.push({
      url: normalized,
      title: item.title,
      sourceName: feed.name,
      sourceWeight: feed.weight,
      market: feed.market,
    })
    return candidates
  }

  const extracted = await extractCandidatesFromIntermediary(item.link, feed)
  for (const url of extracted) {
    candidates.push({
      url,
      title: item.title,
      sourceName: feed.name,
      sourceWeight: feed.weight,
      market: feed.market,
    })
  }

  return candidates
}

export async function runLPDiscovery(): Promise<LPDiscoveryResult> {
  const feeds = getFeedDefinitions()
  if (!feeds.length) {
    throw new Error('LP discovery feeds are empty. Set LP_DISCOVERY_FEEDS or enable LP_DISCOVERY_USE_DEFAULT_FEEDS=true')
  }

  const perFeedLimit = Number(process.env.LP_DISCOVERY_LIMIT_PER_FEED ?? '10')
  const minScore = Number(process.env.LP_DISCOVERY_MIN_SCORE ?? '70')
  const minHeuristic = Number(process.env.LP_DISCOVERY_MIN_HEURISTIC_SCORE ?? '10')
  const minLpHtmlScore = Number(process.env.LP_HTML_MIN_SCORE ?? '20')
  const jpOnly = String(process.env.LP_DISCOVERY_JP_ONLY ?? 'false').toLowerCase() === 'true'
  const requirePerformanceSignal = String(process.env.LP_DISCOVERY_REQUIRE_PERFORMANCE_SIGNAL ?? 'false').toLowerCase() === 'true'

  const supabase = createServiceClient({ requireServiceRole: true })
  const result: LPDiscoveryResult = {
    discovered: 0,
    inserted: 0,
    analyzed: 0,
    activated: 0,
    skipped: 0,
    heuristic_skipped: 0,
    errors: 0,
    feed_errors: 0,
    feed_error_details: [],
  }

  for (const feed of feeds) {
    try {
      const parsed = await fetchFeedWithFallback(feed)
      const items = parsed.items.slice(0, perFeedLimit)

      for (const item of items) {
        const candidates = await collectCandidates(feed, { link: item.link, title: item.title ?? undefined })
        for (const candidate of candidates) {
          result.discovered++

          if (jpOnly && !isJapaneseCandidate(candidate.url)) {
            result.heuristic_skipped++
            continue
          }

          const textForSignal = `${candidate.title ?? ''} ${candidate.url}`
          if (requirePerformanceSignal && !containsPerformanceSignal(textForSignal)) {
            result.heuristic_skipped++
            continue
          }

          const score = heuristicScore(candidate)
          if (score < minHeuristic) {
            result.heuristic_skipped++
            continue
          }

          const { data: existing } = await supabase
            .from('lps')
            .select('id')
            .eq('url', candidate.url)
            .maybeSingle()

          if (existing) {
            result.skipped++
            continue
          }

          // B3: HTMLを取得してLP判定。ブログ記事等をAI分析前に除外する
          const html = await fetchLpHtml(candidate.url)
          if (!html) {
            result.skipped++
            continue
          }

          const lpHtmlScore = scoreLpHtml(html)
          if (lpHtmlScore < minLpHtmlScore) {
            result.heuristic_skipped++
            continue
          }

          const { data: lp, error: insertError } = await supabase
            .from('lps')
            .insert({
              url: candidate.url,
              title: candidate.title ?? null,
              status: 'archived',
              ad_platform: `auto_discovered:${candidate.sourceName}`,
            })
            .select()
            .single()

          if (insertError || !lp) {
            result.errors++
            continue
          }

          result.inserted++

          try {
            // A1: 事前取得済みHTMLをそのまま渡すことで再フェッチを回避
            // A3: LLMがindustry/purpose/target_audienceをページ内容から推論する
            const analysis = await analyzeLP({
              url: candidate.url,
              industry: '不明',
              purpose: '不明',
              target_audience: '不明',
              days_active: 30,
              rawHtml: html,
            })

            // lp_analysesにはinferred_*フィールドは不要なので除外して保存
            const {
              inferred_industry,
              inferred_purpose,
              inferred_target_audience,
              embedding,
              ...analysisData
            } = analysis

            await supabase.from('lp_analyses').insert({
              lp_id: lp.id,
              ...analysisData,
              ...(embedding ? { embedding } : {}),
            })

            const shouldActivate = (analysis.total_score ?? 0) >= minScore

            // A3: 推論したメタデータをlpsテーブルに保存
            await supabase
              .from('lps')
              .update({
                status: shouldActivate ? 'active' : 'archived',
                last_checked_at: new Date().toISOString(),
                ...(inferred_industry ? { industry: inferred_industry } : {}),
                ...(inferred_purpose ? { purpose: inferred_purpose } : {}),
                ...(inferred_target_audience ? { target_audience: inferred_target_audience } : {}),
              })
              .eq('id', lp.id)

            result.analyzed++
            if (shouldActivate) result.activated++
          } catch (analysisError) {
            console.error('LP analysis failed for discovered LP:', candidate.url, analysisError)
            result.errors++
          }
        }
      }
    } catch (feedError) {
      const message = feedError instanceof Error ? feedError.message : 'feed_fetch_failed'
      console.error('LP discovery feed fetch failed:', feed.url, feedError)
      result.errors++
      result.feed_errors++
      result.feed_error_details.push(message)
    }
  }

  return result
}
