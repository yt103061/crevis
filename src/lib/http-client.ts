/**
 * 共通HTTPクライアント
 * 全外部サイトへのfetchはこのモジュール経由で行う
 * - User-Agent設定
 * - タイムアウト制御
 * - ドメイン別レート制限
 * - robots.txtの最低限チェック
 */

import { acquireRateLimit, extractDomain } from '@/lib/rate-limiter'

const USER_AGENT = 'CreVis Bot/1.0 (+https://crevis.jp)'
const DEFAULT_TIMEOUT_MS = 10000

// robots.txtキャッシュ（プロセス内）
const robotsCache = new Map<string, string>()

/**
 * robots.txtを取得してDisallowルールを返す
 */
async function fetchRobotsTxt(domain: string): Promise<string[]> {
  const cached = robotsCache.get(domain)
  if (cached !== undefined) return cached.split('\n').filter((l) => l.trim())

  try {
    const res = await fetch(`https://${domain}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      robotsCache.set(domain, '')
      return []
    }
    const text = await res.text()
    robotsCache.set(domain, text)
    return text.split('\n').filter((l) => l.trim())
  } catch {
    robotsCache.set(domain, '')
    return []
  }
}

/**
 * URLパスがrobots.txtのDisallowルールに一致するか確認する
 * シンプルな実装（ワイルドカード不対応）
 */
async function isDisallowed(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url)
    const domain = parsed.hostname
    const path = parsed.pathname

    const lines = await fetchRobotsTxt(domain)
    let userAgentMatch = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        const agent = trimmed.slice('user-agent:'.length).trim()
        userAgentMatch = agent === '*' || agent.toLowerCase() === 'crevis bot'
      }
      if (userAgentMatch && trimmed.toLowerCase().startsWith('disallow:')) {
        const disallowed = trimmed.slice('disallow:'.length).trim()
        if (disallowed && path.startsWith(disallowed)) {
          return true
        }
      }
    }
    return false
  } catch {
    return false
  }
}

export interface FetchExternalOptions {
  timeoutMs?: number
  skipRobotsCheck?: boolean
  skipRateLimit?: boolean
  maxRatePerMinute?: number
}

/**
 * 外部URLからコンテンツを取得する共通クライアント
 */
export async function fetchExternal(
  url: string,
  options: FetchExternalOptions = {}
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipRobotsCheck = false,
    skipRateLimit = false,
    maxRatePerMinute = 10,
  } = options

  // robots.txtチェック
  if (!skipRobotsCheck) {
    const blocked = await isDisallowed(url)
    if (blocked) {
      throw new Error(`robots.txt disallows access to: ${url}`)
    }
  }

  // レートリミット
  if (!skipRateLimit) {
    const domain = extractDomain(url)
    await acquireRateLimit(domain, maxRatePerMinute)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    })
    return res
  } finally {
    clearTimeout(timeout)
  }
}
