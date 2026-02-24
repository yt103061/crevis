import RSSParser from 'rss-parser'
import { analyzeLP } from '@/lib/ai-client'
import { createServiceClient } from '@/lib/supabase'

const parser = new RSSParser({ timeout: 10000 })

export interface LPDiscoveryResult {
  discovered: number
  inserted: number
  analyzed: number
  activated: number
  skipped: number
  errors: number
}

function getFeedUrls(): string[] {
  const raw = process.env.LP_DISCOVERY_FEEDS ?? ''
  return raw
    .split(',')
    .map((url) => url.trim())
    .filter((url) => !!url)
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

export async function runLPDiscovery(): Promise<LPDiscoveryResult> {
  const feedUrls = getFeedUrls()
  if (!feedUrls.length) {
    throw new Error('LP_DISCOVERY_FEEDS is empty')
  }

  const perFeedLimit = Number(process.env.LP_DISCOVERY_LIMIT_PER_FEED ?? '10')
  const minScore = Number(process.env.LP_DISCOVERY_MIN_SCORE ?? '70')

  const supabase = createServiceClient()
  const result: LPDiscoveryResult = {
    discovered: 0,
    inserted: 0,
    analyzed: 0,
    activated: 0,
    skipped: 0,
    errors: 0,
  }

  for (const feedUrl of feedUrls) {
    try {
      const feed = await parser.parseURL(feedUrl)
      const items = feed.items.slice(0, perFeedLimit)

      for (const item of items) {
        if (!item.link) continue
        result.discovered++

        const normalized = normalizeUrl(item.link)
        if (!normalized) {
          result.skipped++
          continue
        }

        const { data: existing } = await supabase
          .from('lps')
          .select('id')
          .eq('url', normalized)
          .single()

        if (existing) {
          result.skipped++
          continue
        }

        const reachable = await isReachable(normalized)
        if (!reachable) {
          result.skipped++
          continue
        }

        const { data: lp, error: insertError } = await supabase
          .from('lps')
          .insert({
            url: normalized,
            title: item.title ?? null,
            status: 'archived',
            ad_platform: 'auto_discovered',
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
            url: normalized,
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
          console.error('LP analysis failed for discovered LP:', normalized, analysisError)
          result.errors++
        }
      }
    } catch (feedError) {
      console.error('LP discovery feed fetch failed:', feedUrl, feedError)
      result.errors++
    }
  }

  return result
}
