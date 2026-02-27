/**
 * SerpAPI連携によるLP URL発掘モジュール
 *
 * Source A: engine=google → response.ads[] → 直接LP URL（最高品質）
 * Source B: engine=google_ads_transparency_center → advertiser_id → 稼働日数
 *
 * 無料枠: 100検索/月。キャッシュは消費しない。
 */

export interface SerpAPILPCandidate {
  url: string
  domain: string
  advertiser?: string
  advertiserId?: string
  daysActive?: number
  firstShown?: number  // Unix timestamp
  lastShown?: number
  keywords?: string[]
  source: 'serpapi_search' | 'serpapi_transparency'
  sourceWeight: number
}

const SERPAPI_KEY = process.env.SERPAPI_KEY ?? ''

/**
 * Source A: Google検索広告結果からLP URLを直接取得
 * 1回の検索 = 3〜5本のLP URL、広告入札済み = 確実にCVR目的のLP
 */
export async function discoverFromGoogleSearchAds(keyword: string, region = 'jp'): Promise<SerpAPILPCandidate[]> {
  if (!SERPAPI_KEY) return []

  const params = new URLSearchParams({
    engine: 'google',
    q: keyword,
    gl: region,
    hl: 'ja',
    api_key: SERPAPI_KEY,
  })

  let data: Record<string, unknown>
  try {
    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    data = await res.json()
  } catch {
    return []
  }

  const candidates: SerpAPILPCandidate[] = []
  const ads = (data.ads as unknown[]) ?? []

  for (const ad of ads) {
    const a = ad as Record<string, unknown>
    const link = (a.link ?? a.displayed_link) as string | undefined
    if (!link) continue

    let domain = ''
    try { domain = new URL(link).hostname.replace(/^www\./, '') } catch { continue }

    candidates.push({
      url: link,
      domain,
      source: 'serpapi_search',
      keywords: [keyword],
      sourceWeight: 50,  // 最高ウェイト（実際に広告費を払っている）
    })

    // サイトリンクも取得
    const sitelinks = (a.sitelinks as unknown[]) ?? []
    for (const sl of sitelinks) {
      const s = sl as Record<string, unknown>
      const slLink = s.link as string | undefined
      if (slLink) {
        try {
          const slDomain = new URL(slLink).hostname.replace(/^www\./, '')
          candidates.push({
            url: slLink,
            domain: slDomain,
            source: 'serpapi_search',
            keywords: [keyword],
            sourceWeight: 45,
          })
        } catch { /* skip */ }
      }
    }
  }

  return candidates
}

/**
 * Source B: Google Ads Transparency CenterでドメインのAds稼働データを取得
 * advertiser_idピボット: 同一広告主の別LP URLを芋づる式に発見
 */
export async function getAdTransparencyForDomain(domain: string): Promise<{
  daysActive: number
  advertiserId: string | null
  firstShown: number | null
  lastShown: number | null
}> {
  if (!SERPAPI_KEY) return { daysActive: 0, advertiserId: null, firstShown: null, lastShown: null }

  const params = new URLSearchParams({
    engine: 'google_ads_transparency_center',
    text: domain,
    region: '2392', // JP
    api_key: SERPAPI_KEY,
  })

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { daysActive: 0, advertiserId: null, firstShown: null, lastShown: null }

    const data = await res.json()
    const creatives = (data.ad_creatives as unknown[]) ?? []
    if (!creatives.length) return { daysActive: 0, advertiserId: null, firstShown: null, lastShown: null }

    // 最も稼働日数が長いクリエイティブを選ぶ
    let maxDays = 0
    let advertiserId: string | null = null
    let firstShown: number | null = null
    let lastShown: number | null = null

    for (const c of creatives) {
      const creative = c as Record<string, unknown>
      const fs = creative.first_shown as number | undefined
      const ls = creative.last_shown as number | undefined
      if (fs && ls) {
        const days = Math.round((ls - fs) / 86400)
        if (days > maxDays) {
          maxDays = days
          advertiserId = creative.advertiser_id as string ?? null
          firstShown = fs
          lastShown = ls
        }
      }
    }

    return { daysActive: maxDays, advertiserId, firstShown, lastShown }
  } catch {
    return { daysActive: 0, advertiserId: null, firstShown: null, lastShown: null }
  }
}

/**
 * advertiser_idピボット: 同一広告主の全ドメインを取得
 * 1ブランドから3〜10の関連LPドメインを発見できる
 */
export async function getDomainsFromAdvertiserId(advertiserId: string): Promise<string[]> {
  if (!SERPAPI_KEY || !advertiserId) return []

  const params = new URLSearchParams({
    engine: 'google_ads_transparency_center',
    advertiser_id: advertiserId,
    region: '2392',
    api_key: SERPAPI_KEY,
  })

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const creatives = (data.ad_creatives as unknown[]) ?? []

    const domains = new Set<string>()
    for (const c of creatives) {
      const creative = c as Record<string, unknown>
      const targetDomain = creative.target_domain as string | undefined
      if (targetDomain) domains.add(targetDomain.replace(/^www\./, ''))
    }
    return Array.from(domains)
  } catch {
    return []
  }
}
