import { DomainRateLimiter } from '@/lib/rate-limiter'

const USER_AGENT = 'CreVis Bot/1.0 (+https://crevis.jp)'
const DEFAULT_TIMEOUT_MS = 10000
const limiter = new DomainRateLimiter(1500)
const robotsCache = new Map<string, { disallow: string[]; fetchedAt: number }>()

async function getRobots(url: URL): Promise<string[]> {
  const origin = `${url.protocol}//${url.host}`
  const cached = robotsCache.get(origin)
  if (cached && Date.now() - cached.fetchedAt < 10 * 60 * 1000) {
    return cached.disallow
  }

  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      robotsCache.set(origin, { disallow: [], fetchedAt: Date.now() })
      return []
    }

    const text = await res.text()
    const disallow: string[] = []
    const lines = text.split(/\r?\n/)
    let inStarBlock = false

    for (const line of lines) {
      const clean = line.trim()
      if (!clean || clean.startsWith('#')) continue
      const ua = clean.match(/^user-agent:\s*(.+)$/i)
      if (ua) {
        inStarBlock = ua[1].trim() === '*'
        continue
      }
      if (!inStarBlock) continue
      const dis = clean.match(/^disallow:\s*(.*)$/i)
      if (dis && dis[1].trim()) {
        disallow.push(dis[1].trim())
      }
    }

    robotsCache.set(origin, { disallow, fetchedAt: Date.now() })
    return disallow
  } catch {
    return []
  }
}

async function assertRobotsAllowed(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl)
  const disallow = await getRobots(url)
  const path = url.pathname || '/'

  for (const rule of disallow) {
    if (rule === '/') {
      throw new Error(`Blocked by robots.txt: ${rawUrl}`)
    }
    if (rule !== '' && path.startsWith(rule)) {
      throw new Error(`Blocked by robots.txt: ${rawUrl}`)
    }
  }
}

export async function fetchExternal(
  url: string,
  options?: { timeoutMs?: number; init?: RequestInit }
): Promise<Response> {
  await limiter.waitForDomain(url)
  await assertRobotsAllowed(url)

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...(options?.init ?? {}),
      headers: {
        'User-Agent': USER_AGENT,
        ...(options?.init?.headers ?? {}),
      },
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`fetchExternal failed: ${res.status} ${res.statusText} (${url})`)
    }

    return res
  } catch (error) {
    console.error('fetchExternal error:', url, error)
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
