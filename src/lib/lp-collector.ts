/**
 * LP自動収集エンジン
 * 既存LPギャラリーサイトからLP候補URLを自動収集する
 */

import * as cheerio from 'cheerio'
import { fetchExternal } from '@/lib/http-client'

export interface GallerySourceConfig {
  base_url: string        // ギャラリーの新着一覧ページURL
  list_selector: string   // 記事リストのCSSセレクタ
  link_selector: string   // 各記事内のLP外部リンクのCSSセレクタ
  pagination?: string     // ページネーションの次ページセレクタ
  max_pages?: number      // 最大ページ遡り数（デフォルト3）
}

export interface CollectedLP {
  url: string
  pageTitle: string | null
  pageDomain: string
}

/**
 * URLを正規化する（クエリパラメータ除去・トレイリングスラッシュ統一）
 */
function normalizeUrl(raw: string, baseUrl?: string): string | null {
  try {
    const url = baseUrl ? new URL(raw, baseUrl) : new URL(raw)
    // 同一ドメインへの内部リンクは除外
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

/**
 * 収集すべきでないURLパターン
 */
const SKIP_URL_PATTERNS = [
  /\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js)$/i,
  /\/feed\//,
  /\/category\//,
  /\/tag\//,
  /\/page\/\d+/,
  /^mailto:/,
  /^tel:/,
]

function shouldSkipUrl(url: string): boolean {
  return SKIP_URL_PATTERNS.some((p) => p.test(url))
}

/**
 * ギャラリーサイトからLP候補URLを収集する
 */
export async function collectFromGallery(
  config: GallerySourceConfig,
  existingUrls: Set<string>
): Promise<CollectedLP[]> {
  const maxPages = config.max_pages ?? 3
  const collected: CollectedLP[] = []
  const seen = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = page === 1
      ? config.base_url
      : config.pagination
        ? config.base_url.replace('{page}', String(page))
        : null

    if (!pageUrl) break

    let html: string
    try {
      const res = await fetchExternal(pageUrl, {
        timeoutMs: 12000,
        maxRatePerMinute: 5,
      })
      if (!res.ok) break
      html = await res.text()
    } catch (err) {
      console.warn(`Failed to fetch gallery page ${pageUrl}:`, err)
      break
    }

    const $ = cheerio.load(html)
    let foundOnPage = 0

    // リストアイテムを取得
    $(config.list_selector).each((_, item) => {
      // 各リストアイテム内のリンクを探す
      const links: string[] = []
      $(item).find(config.link_selector).each((_, el) => {
        const href = $(el).attr('href')
        if (href) links.push(href)
      })

      // リストアイテム自体がリンクの場合
      if (links.length === 0) {
        const href = $(item).attr('href') ?? $(item).closest('a').attr('href')
        if (href) links.push(href)
      }

      for (const rawHref of links) {
        const normalized = normalizeUrl(rawHref, pageUrl)
        if (!normalized) continue
        if (shouldSkipUrl(normalized)) continue

        // ギャラリーサイト自身のURLは除外
        try {
          const galleryHost = new URL(config.base_url).hostname
          const candidateHost = new URL(normalized).hostname
          if (candidateHost === galleryHost) continue
        } catch {
          continue
        }

        if (seen.has(normalized)) continue
        if (existingUrls.has(normalized)) continue

        seen.add(normalized)
        foundOnPage++

        let pageDomain = ''
        try {
          pageDomain = new URL(normalized).hostname
        } catch {
          continue
        }

        collected.push({
          url: normalized,
          pageTitle: $(item).find('h2, h3, .title, .name').first().text().trim() || null,
          pageDomain,
        })
      }
    })

    // そのページで新規URLが取れなければ終了
    if (foundOnPage === 0) break
  }

  return collected
}

/**
 * サイトマップからURL一覧を取得する
 * （NL収集でも使用）
 */
export async function fetchFromSitemap(sitemapUrl: string): Promise<{ url: string; lastmod?: string }[]> {
  try {
    const res = await fetchExternal(sitemapUrl, { timeoutMs: 10000 })
    if (!res.ok) return []
    const xml = await res.text()
    const $ = cheerio.load(xml, { xmlMode: true })
    const results: { url: string; lastmod?: string }[] = []
    $('url').each((_, el) => {
      const loc = $(el).find('loc').text().trim()
      const lastmod = $(el).find('lastmod').text().trim() || undefined
      if (loc) results.push({ url: loc, lastmod })
    })
    return results
  } catch {
    return []
  }
}

/**
 * ブログ一覧ページをスクレイピングして記事URLを取得する
 */
export async function fetchFromScrape(config: {
  list_url: string
  article_selector: string
  link_selector: string
  max_pages?: number
}): Promise<{ url: string; title: string }[]> {
  const maxPages = config.max_pages ?? 2
  const results: { url: string; title: string }[] = []
  const seen = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = page === 1 ? config.list_url : null
    if (!pageUrl) break

    try {
      const res = await fetchExternal(pageUrl, { timeoutMs: 12000, maxRatePerMinute: 5 })
      if (!res.ok) break
      const html = await res.text()
      const $ = cheerio.load(html)

      $(config.article_selector).each((_, el) => {
        const link = $(el).find(config.link_selector).first()
        const href = link.attr('href')
        const title = link.text().trim() || $(el).find('h2, h3').first().text().trim()
        if (!href || !title) return
        const normalized = normalizeUrl(href, pageUrl)
        if (!normalized || seen.has(normalized)) return
        seen.add(normalized)
        results.push({ url: normalized, title })
      })
    } catch {
      break
    }
  }

  return results
}
