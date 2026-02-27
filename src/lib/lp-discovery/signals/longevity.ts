/**
 * Longevity Score (生存期間スコア)
 *
 * Internet Archive Wayback Machine の CDX API を利用して
 * 対象URLの最初のスナップショット日時を取得し、スコアを算出する。
 *
 * スコア基準:
 *   0-30日:    0点  (新しすぎて効果判定不能)
 *   30-90日:   10-30点 (短期運用)
 *   90-180日:  30-60点 (中期運用)
 *   180-365日: 60-85点 (長期運用)
 *   365日以上: 85-100点 (実戦で証明済み)
 */

export interface LongevityResult {
  firstSeen: Date | null
  ageInDays: number
  longevityScore: number
  snapshotCount: number
}

function calcScore(ageInDays: number): number {
  if (ageInDays < 30) return 0
  if (ageInDays < 90) return Math.round(10 + ((ageInDays - 30) / 60) * 20)
  if (ageInDays < 180) return Math.round(30 + ((ageInDays - 90) / 90) * 30)
  if (ageInDays < 365) return Math.round(60 + ((ageInDays - 180) / 185) * 25)
  return Math.min(100, Math.round(85 + ((ageInDays - 365) / 365) * 15))
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0)' },
      })
      if (res.ok) return res
    } catch {
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)))
      }
    }
  }
  return null
}

export async function checkLongevity(url: string): Promise<LongevityResult> {
  const defaultResult: LongevityResult = {
    firstSeen: null,
    ageInDays: 0,
    longevityScore: 0,
    snapshotCount: 0,
  }

  try {
    // 最古のスナップショットを CDX API で取得
    const cdxUrl =
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}` +
      `&output=json&limit=1&sort=asc&fl=timestamp`

    const cdxRes = await fetchWithRetry(cdxUrl)
    if (!cdxRes) return defaultResult

    const cdxData = (await cdxRes.json()) as string[][]
    // 行0: ヘッダー, 行1: 最初のスナップショット
    if (!cdxData || cdxData.length < 2) return defaultResult

    const timestamp = cdxData[1][0] // yyyyMMddHHmmss 形式
    if (!timestamp || timestamp.length < 8) return defaultResult

    const year = parseInt(timestamp.slice(0, 4), 10)
    const month = parseInt(timestamp.slice(4, 6), 10) - 1
    const day = parseInt(timestamp.slice(6, 8), 10)
    const firstSeen = new Date(year, month, day)

    const ageInDays = Math.floor(
      (Date.now() - firstSeen.getTime()) / (1000 * 60 * 60 * 24)
    )

    // スナップショット数（概算）- レート制限対策で1秒待機
    await new Promise((r) => setTimeout(r, 1000))
    let snapshotCount = 0
    const countUrl =
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}` +
      `&output=json&limit=0&showNumPages=true`
    const countRes = await fetchWithRetry(countUrl)
    if (countRes) {
      const text = await countRes.text()
      snapshotCount = parseInt(text.trim(), 10) || 0
    }

    return {
      firstSeen,
      ageInDays,
      longevityScore: calcScore(ageInDays),
      snapshotCount,
    }
  } catch {
    return defaultResult
  }
}
