import RSSParser from 'rss-parser'
import { analyzeLP } from '@/lib/ai-client'
import { createServiceClient } from '@/lib/supabase'
import { DEFAULT_LP_DISCOVERY_FEEDS, type LPDiscoveryFeed } from '@/lib/automation/default-feeds'

const parser = new RSSParser({ timeout: 10000 })

export interface LPDiscoveryResult {
  discovered: number
  inserted: number
  analyzed: number
  activated: number
  skipped: number
  heuristic_skipped: number
  errors: number
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

function heuristicScore(candidate: Candidate): number {
  let score = candidate.sourceWeight
  if (isJapaneseCandidate(candidate.url)) score += 24

  if (containsLpIntentKeyword(candidate.url)) score += 18
  if (candidate.title && containsLpIntentKeyword(candidate.title)) score += 16

  if (candidate.market === 'jp') score += 12
  if (candidate.url.includes('/lp') || candidate.url.includes('/campaign')) score += 8

  return score
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
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

async function extractCandidatesFromIntermediary(itemLink: string, feed: LPDiscoveryFeed): Promise<string[]> {
  try {
    const res = await fetch(itemLink, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const html = await res.text()

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
      .filter((u) => !u.includes('twitter.com') && !u.includes('x.com') && !u.includes('facebook.com'))

    // PR由来は重複が多いのでユニーク化
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
  const minHeuristic = Number(process.env.LP_DISCOVERY_MIN_HEURISTIC_SCORE ?? '55')
  const jpOnly = String(process.env.LP_DISCOVERY_JP_ONLY ?? 'true').toLowerCase() === 'true'

  const supabase = createServiceClient({ requireServiceRole: true })
  const result: LPDiscoveryResult = {
    discovered: 0,
    inserted: 0,
    analyzed: 0,
    activated: 0,
    skipped: 0,
    heuristic_skipped: 0,
    errors: 0,
  }

  for (const feed of feeds) {
    try {
      const parsed = await parser.parseURL(feed.url)
      const items = parsed.items.slice(0, perFeedLimit)

      for (const item of items) {
        const candidates = await collectCandidates(feed, { link: item.link, title: item.title ?? undefined })
        for (const candidate of candidates) {
          result.discovered++

          if (jpOnly && !isJapaneseCandidate(candidate.url)) {
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

          const reachable = await isReachable(candidate.url)
          if (!reachable) {
            result.skipped++
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
            const analysis = await analyzeLP({
              url: candidate.url,
              industry: '不明',
              purpose: '不明',
              target_audience: '不明',
              days_active: 30,
            })

            await supabase.from('lp_analyses').insert({
              lp_id: lp.id,
              ...analysis,
            })

            const shouldActivate = (analysis.total_score ?? 0) >= minScore
            await supabase
              .from('lps')
              .update({
                status: shouldActivate ? 'active' : 'archived',
                last_checked_at: new Date().toISOString(),
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
      console.error('LP discovery feed fetch failed:', feed.url, feedError)
      result.errors++
    }
  }

  return result
}
