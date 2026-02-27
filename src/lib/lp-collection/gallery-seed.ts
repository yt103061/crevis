/**
 * ギャラリーサイトシードLP収集モジュール
 *
 * 既存のLPギャラリーサイト（sankoudesign, muuuuu.org 等）を
 * シードとして収集し、広告逆算でCreVisの独自価値を付加する。
 *
 * 収集戦略:
 *  1. サイトマップ (sitemap.xml) からLP URLを直接列挙
 *  2. 各ギャラリーページのHTMLからリンク href を抽出
 *  3. 正規化後、既存 scoreLpHtml + AI分析パイプラインに流す
 */

export interface GallerySeedLP {
  url: string
  sourceGallery: string
  sourceWeight: number
}

interface GallerySource {
  name: string
  sitemapUrl?: string
  indexUrls: string[]
  weight: number
  /** ギャラリーページ内の自サイトリンクを除外するパターン */
  linkPattern?: RegExp
}

const GALLERY_SOURCES: GallerySource[] = [
  {
    name: 'sankoudesign',
    // sankoudesign.com は1ページ内に多数のLP外部リンクを掲載
    indexUrls: [
      'https://sankoudesign.com/',
      'https://sankoudesign.com/page/2/',
      'https://sankoudesign.com/page/3/',
    ],
    weight: 35,
    linkPattern: /sankoudesign\.com/,
  },
  {
    name: 'muuuuu_org',
    // muuuuu.org はサイトマップから直接収集可能
    sitemapUrl: 'https://muuuuu.org/sitemap.xml',
    indexUrls: ['https://muuuuu.org/'],
    weight: 32,
    linkPattern: /muuuuu\.org/,
  },
  {
    name: 'land_book',
    indexUrls: ['https://land-book.com/'],
    weight: 28,
    linkPattern: /land-book\.com/,
  },
]

/** sitemap.xml から <loc> を全件抽出 */
async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  try {
    const res = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    const matches = xml.match(/<loc>([^<]+)<\/loc>/g) ?? []
    return matches
      .map((m) => m.replace(/<\/?loc>/g, '').trim())
      .filter((u) => u.startsWith('http'))
  } catch {
    return []
  }
}

/** ギャラリーページのHTMLから外部LPリンクを抽出 */
async function extractExternalLinksFromGallery(
  pageUrl: string,
  excludePattern: RegExp
): Promise<string[]> {
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    const html = await res.text()

    const links: string[] = []
    const regex = /href=["'](https?:\/\/[^"']+)["']/g
    let m: RegExpExecArray | null
    while ((m = regex.exec(html)) !== null) {
      const href = m[1]
      // ギャラリー自身のドメインを除外
      if (excludePattern.test(href)) continue
      // SNS・広告トラッカーを除外
      if (/twitter\.com|facebook\.com|instagram\.com|youtube\.com|google\.|amazon\.|apple\.com|bit\.ly/.test(href)) continue
      // 正規化（クエリとハッシュを除去）
      try {
        const parsed = new URL(href)
        const clean = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '')
        links.push(clean)
      } catch { /* skip */ }
    }
    return Array.from(new Set(links))
  } catch {
    return []
  }
}

/**
 * ギャラリーサイト群からLP URLを収集する
 * @param limit 1ギャラリーあたりの最大収集数
 */
export async function scrapeGallerySeedLPs(limit = 30): Promise<GallerySeedLP[]> {
  const results: GallerySeedLP[] = []
  const seen = new Set<string>()

  for (const source of GALLERY_SOURCES) {
    const urls: string[] = []

    // サイトマップ収集
    if (source.sitemapUrl) {
      const sitemapUrls = await fetchSitemapUrls(source.sitemapUrl)
      // ギャラリー記事ページを解析してLP URLを取得
      for (const pageUrl of sitemapUrls.slice(0, 20)) {
        if (source.linkPattern && !source.linkPattern.test(pageUrl)) continue
        const links = await extractExternalLinksFromGallery(
          pageUrl,
          source.linkPattern ?? /$/
        )
        urls.push(...links)
        await new Promise((r) => setTimeout(r, 800))
      }
    }

    // インデックスページ収集
    for (const indexUrl of source.indexUrls) {
      const links = await extractExternalLinksFromGallery(
        indexUrl,
        source.linkPattern ?? /$/
      )
      urls.push(...links)
      await new Promise((r) => setTimeout(r, 1000))
    }

    let count = 0
    for (const url of urls) {
      if (count >= limit) break
      if (seen.has(url)) continue
      seen.add(url)
      results.push({ url, sourceGallery: source.name, sourceWeight: source.weight })
      count++
    }
  }

  return results
}
