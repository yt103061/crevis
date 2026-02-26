/**
 * Wayback Machine CDX APIを使ってLPの掲載日数を推定する
 */

const CDX_API = 'https://web.archive.org/cdx/search/cdx'
const TIMEOUT_MS = 8000

/**
 * URLが最初にアーカイブされた日からの経過日数を返す
 * アーカイブが存在しない場合や取得失敗時は 0 を返す
 */
export async function estimateDaysActive(url: string): Promise<number> {
  try {
    const params = new URLSearchParams({
      url,
      output: 'json',
      limit: '1',
      fl: 'timestamp',
      filter: 'statuscode:200',
      fastLatest: 'true',
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(`${CDX_API}?${params.toString()}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CreVis/1.0 (LP research tool)' },
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) return 0

    const json = await res.json() as string[][]
    // 最初の行はヘッダー ["timestamp"] なのでスキップ
    const dataRows = json.slice(1)
    if (!dataRows.length || !dataRows[0]?.[0]) return 0

    const timestamp = dataRows[0][0] // 例: "20230105120000"
    const firstSeen = parseWaybackTimestamp(timestamp)
    if (!firstSeen) return 0

    const now = Date.now()
    const diffMs = now - firstSeen.getTime()
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  } catch {
    return 0
  }
}

/**
 * Wayback Machine のタイムスタンプ (YYYYMMDDHHmmss) を Date に変換する
 */
function parseWaybackTimestamp(ts: string): Date | null {
  if (ts.length < 8) return null
  const year = parseInt(ts.slice(0, 4), 10)
  const month = parseInt(ts.slice(4, 6), 10) - 1
  const day = parseInt(ts.slice(6, 8), 10)
  const date = new Date(year, month, day)
  if (isNaN(date.getTime())) return null
  return date
}
