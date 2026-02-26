import { fetchExternal } from '@/lib/http-client'

export async function estimateDaysActive(url: string): Promise<number> {
  try {
    const target = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=1&fl=timestamp&sort=asc`
    const res = await fetchExternal(target, { timeoutMs: 5000 })
    const data = (await res.json()) as string[][]
    const timestamp = data?.[1]?.[0]

    if (!timestamp) {
      return 30
    }

    const year = Number(timestamp.slice(0, 4))
    const month = Number(timestamp.slice(4, 6)) - 1
    const day = Number(timestamp.slice(6, 8))
    const firstSeen = new Date(Date.UTC(year, month, day))
    const diffMs = Date.now() - firstSeen.getTime()

    if (Number.isNaN(diffMs) || diffMs < 0) return 30
    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  } catch (error) {
    console.error('estimateDaysActive failed:', error)
    return 30
  }
}
