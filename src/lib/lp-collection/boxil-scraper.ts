/**
 * JP SaaS比較サイトスクレイパー
 *
 * BOXIL・起業ログ・ITreviewは「販売意図が確実なSaaS」のカタログ。
 * 各プロダクトの「公式サイトへ」リンクからドメインを取得し、
 * robots-probe + wayback-cdxでLP URLを発掘する。
 */

export interface SaaSProductLP {
  domain: string
  productName: string
  source: 'boxil' | 'kigyolog' | 'itreview'
}

export async function scrapeBoxilDomains(limit = 50): Promise<SaaSProductLP[]> {
  const results: SaaSProductLP[] = []
  const seenDomains = new Set<string>()

  // BOXILのカテゴリ一覧ページを取得
  const categories = [
    'https://boxil.jp/service/',
    'https://boxil.jp/service/crm/',
    'https://boxil.jp/service/hr/',
    'https://boxil.jp/service/cloud-accounting/',
    'https://boxil.jp/service/ma/',
  ]

  for (const categoryUrl of categories) {
    if (results.length >= limit) break

    try {
      const res = await fetch(categoryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue

      const html = await res.text()

      // 「公式サイトへ」リンクの href を抽出（外部ドメインのみ）
      const officialLinkRegex = /href=["'](https?:\/\/(?!boxil\.jp)[^"']+)["'][^>]*>[^<]*(?:公式|official|サービスサイト)/gi
      let match
      while ((match = officialLinkRegex.exec(html)) !== null) {
        const href = match[1]
        try {
          const domain = new URL(href).hostname.replace(/^www\./, '')
          if (!seenDomains.has(domain) && results.length < limit) {
            seenDomains.add(domain)
            const productName = href.split('/')[2] ?? domain
            results.push({ domain, productName, source: 'boxil' })
          }
        } catch { /* skip */ }
      }

      // 外部リンク全般からドメインを取得（href内のboxil.jp以外）
      const externalLinkRegex = /href=["'](https?:\/\/(?!boxil\.jp|google\.|facebook\.|twitter\.|linkedin\.|apple\.|microsoft\.)[a-zA-Z0-9\-]+\.(co\.jp|com|io|jp)(?:\/[^"']*)?)["']/g
      while ((match = externalLinkRegex.exec(html)) !== null) {
        const href = match[1]
        try {
          const domain = new URL(href).hostname.replace(/^www\./, '')
          if (!seenDomains.has(domain) && results.length < limit) {
            seenDomains.add(domain)
            results.push({ domain, productName: domain, source: 'boxil' })
          }
        } catch { /* skip */ }
      }
    } catch { /* skip category */ }

    await new Promise((r) => setTimeout(r, 1500))
  }

  return results
}
