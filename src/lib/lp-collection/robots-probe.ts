/**
 * robots.txt Disallow解析によるLPパス発掘モジュール
 *
 * ブランドは /lp/, /campaign/ を robots.txt の Disallow に書くことが多い。
 * これは「そのパスが存在する」の公式申告であり、高品質LP発掘に使える。
 */

export interface RobotsProbedLP {
  url: string
  domain: string
  discoveredPath: string
  source: 'robots_txt'
}

const LP_PATH_PATTERNS = [
  '/lp', '/lp/', '/lp-', '/landing', '/landing/',
  '/campaign', '/campaign/', '/service/', '/trial', '/trial/',
  '/signup', '/form', '/contact-lp', '/cv', '/entry',
  '/お申し込み', '/muryou', '/free-trial',
]

export async function probeLPsFromRobotsTxt(domain: string): Promise<RobotsProbedLP[]> {
  const results: RobotsProbedLP[] = []

  let robotsTxt = ''
  try {
    const res = await fetch(`https://${domain}/robots.txt`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    robotsTxt = await res.text()
  } catch {
    return []
  }

  // Disallow行からパスを抽出
  const disallowedPaths: string[] = []
  for (const line of robotsTxt.split('\n')) {
    const match = line.match(/^Disallow:\s*(.+)/i)
    if (match) {
      const p = match[1].trim().replace(/\*$/, '').replace(/\*/, '')
      if (p && p !== '/' && p.length > 1) disallowedPaths.push(p)
    }
  }

  // LP的パターンを持つDisallowパスをprobeする
  const lpCandidatePaths = disallowedPaths.filter((p) => {
    const lower = p.toLowerCase()
    return LP_PATH_PATTERNS.some((pattern) => lower.includes(pattern.replace('/', '')))
  })

  // さらにデフォルトパターンもprobeする
  const pathsToProbe = Array.from(new Set([
    ...lpCandidatePaths,
    '/lp/', '/lp/top', '/lp/trial', '/lp/campaign',
    '/campaign/', '/landing/', '/trial/',
  ]))

  // 並行HEAD requestで実在確認
  const checks = await Promise.allSettled(
    pathsToProbe.slice(0, 20).map(async (path) => {
      const url = `https://${domain}${path.endsWith('/') ? path.slice(0, -1) : path}`
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
        redirect: 'follow',
      })
      if (res.ok) return { url, path }
      return null
    })
  )

  for (const result of checks) {
    if (result.status === 'fulfilled' && result.value) {
      results.push({
        url: result.value.url,
        domain,
        discoveredPath: result.value.path,
        source: 'robots_txt',
      })
    }
  }

  return results
}
