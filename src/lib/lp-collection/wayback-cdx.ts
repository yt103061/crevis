/**
 * Wayback Machine CDX APIによるLP URL発掘モジュール
 *
 * アーカイブ済みURLからLP系パスを列挙し、現在も生きているURLを返す。
 * コスト: $0。精度: 中（過去に存在したURL）。
 */

export interface WaybackLP {
  url: string
  domain: string
  firstSeen: string  // YYYYMMDD形式
  lastSeen: string
  daysActive: number
  source: 'wayback_cdx'
}

const LP_URL_PATTERNS = [
  '/lp', '/landing', '/campaign', '/trial', '/signup',
  '/form', '/entry', '/cv', '/service/lp',
  // クエリパラメータ系
  'lp=', 'landing=', 'from=lp',
]

export async function discoverLPsFromWayback(domain: string): Promise<WaybackLP[]> {
  // CDX API: ドメイン配下の全URLを取得（LP系パスのみ）
  const cdxUrl = new URL('https://web.archive.org/cdx/search/cdx')
  cdxUrl.searchParams.set('url', `*.${domain}/*`)
  cdxUrl.searchParams.set('output', 'json')
  cdxUrl.searchParams.set('fl', 'original,timestamp,statuscode')
  cdxUrl.searchParams.set('collapse', 'urlkey')
  cdxUrl.searchParams.set('limit', '200')
  cdxUrl.searchParams.set('filter', 'statuscode:200')
  // LP系パスのみ取得
  cdxUrl.searchParams.set('filter', 'original:.*(/lp|/landing|/campaign|/trial|/signup|/form|/cv)')

  let rows: string[][] = []
  try {
    const res = await fetch(cdxUrl.toString(), { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []
    rows = await res.json()
    if (!Array.isArray(rows) || rows.length <= 1) return []
    rows = rows.slice(1) // ヘッダー行を除く
  } catch {
    return []
  }

  // URL別に first/last timestampを集計
  const urlMap = new Map<string, { first: string; last: string }>()
  for (const [original, timestamp] of rows) {
    if (!original || !timestamp) continue
    const existing = urlMap.get(original)
    if (!existing) {
      urlMap.set(original, { first: timestamp, last: timestamp })
    } else {
      if (timestamp < existing.first) existing.first = timestamp
      if (timestamp > existing.last) existing.last = timestamp
    }
  }

  const results: WaybackLP[] = []
  for (const [url, { first, last }] of Array.from(urlMap.entries())) {
    // LP系パスのみ
    if (!LP_URL_PATTERNS.some((p) => url.toLowerCase().includes(p))) continue

    const firstDate = new Date(first.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
    const lastDate = new Date(last.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
    const daysActive = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))

    // 30日以上アーカイブに存在するもの（= 一定期間稼働していた証拠）
    if (daysActive < 30) continue

    results.push({
      url,
      domain,
      firstSeen: first.slice(0, 8),
      lastSeen: last.slice(0, 8),
      daysActive,
      source: 'wayback_cdx',
    })
  }

  // 稼働日数の長い順にソート
  return results.sort((a, b) => b.daysActive - a.daysActive).slice(0, 10)
}

/**
 * Wayback CDX で特定URLの初出日とアーカイブ数を取得する
 * lp-discovery.ts の既存Wayback活用の改善版
 */
export async function getUrlLongevity(url: string): Promise<{ firstSeen: string | null; daysActive: number }> {
  try {
    const cdxUrl = new URL('https://web.archive.org/cdx/search/cdx')
    cdxUrl.searchParams.set('url', url)
    cdxUrl.searchParams.set('output', 'json')
    cdxUrl.searchParams.set('fl', 'timestamp,statuscode')
    cdxUrl.searchParams.set('limit', '1')
    cdxUrl.searchParams.set('from', '20200101')

    const res = await fetch(cdxUrl.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { firstSeen: null, daysActive: 0 }

    const data: string[][] = await res.json()
    if (!Array.isArray(data) || data.length < 2) return { firstSeen: null, daysActive: 0 }

    const firstTimestamp = data[1][0]
    const firstDate = new Date(firstTimestamp.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
    const daysActive = Math.round((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24))

    return { firstSeen: firstTimestamp.slice(0, 8), daysActive }
  } catch {
    return { firstSeen: null, daysActive: 0 }
  }
}
