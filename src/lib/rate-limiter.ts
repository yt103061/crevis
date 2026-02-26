/**
 * シンプルなドメインレートリミッター
 * 外部サイトへの過剰なリクエストを防ぐ
 */

interface RateLimitEntry {
  count: number
  windowStart: number
}

const limits = new Map<string, RateLimitEntry>()

const DEFAULT_MAX_PER_MINUTE = 10
const WINDOW_MS = 60_000

/**
 * ドメインに対するリクエストが制限を超えていないか確認し、超えていれば待機する
 */
export async function acquireRateLimit(domain: string, maxPerMinute = DEFAULT_MAX_PER_MINUTE): Promise<void> {
  const now = Date.now()
  const entry = limits.get(domain)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    limits.set(domain, { count: 1, windowStart: now })
    return
  }

  if (entry.count < maxPerMinute) {
    entry.count++
    return
  }

  // ウィンドウが終わるまで待機
  const wait = WINDOW_MS - (now - entry.windowStart) + 100
  await new Promise((resolve) => setTimeout(resolve, wait))
  limits.set(domain, { count: 1, windowStart: Date.now() })
}

/**
 * URLからドメインを抽出する
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * ドメインに対して一定間隔のディレイを挿入する（礼儀正しいクロール）
 */
export async function politeSleep(domain: string, minMs = 500, maxMs = 1500): Promise<void> {
  const jitter = Math.floor(Math.random() * (maxMs - minMs)) + minMs
  await new Promise((resolve) => setTimeout(resolve, jitter))
  void domain // unused but makes the signature explicit
}
