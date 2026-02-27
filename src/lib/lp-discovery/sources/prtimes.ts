/**
 * PR TIMES 新サービスRSSからLP候補URLを抽出するソースモジュール
 *
 * https://prtimes.jp/index.php?action=rss&cat=15
 * 新サービス/新商品カテゴリのプレスリリース記事本文から
 * 外部リンク（prtimes.jp以外のURL）を候補として抽出する。
 */
import Parser from 'rss-parser'
import { load } from 'cheerio'
import type { CandidateURL } from '@/types'

const PRTIMES_RSS_URL = 'https://prtimes.jp/index.php?action=rss&cat=15'
const SOURCE_NAME = 'prtimes'

// LP可能性が高いパスパターン
const HIGH_PRIORITY_PATHS = [
  '/lp/', '/campaign/', '/promo/', '/landing/', '/service/', '/product/',
]

function isExternalUrl(href: string, baseDomain: string): boolean {
  try {
    const parsed = new URL(href)
    return !parsed.hostname.includes(baseDomain)
  } catch {
    return false
  }
}

function prioritizeUrl(url: string): number {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    if (HIGH_PRIORITY_PATHS.some((p) => pathname.includes(p))) return 2
    if (pathname === '/' || pathname === '') return 1 // トップページも候補
    return 0
  } catch {
    return 0
  }
}

export async function discoverFromPRTimes(): Promise<CandidateURL[]> {
  const parser = new Parser({
    customFields: {
      item: ['description', 'content:encoded'],
    },
    timeout: 15000,
  })

  let feed: Parser.Output<{ description?: string; 'content:encoded'?: string }>
  try {
    feed = await parser.parseURL(PRTIMES_RSS_URL)
  } catch (e) {
    console.error('[PRTimes] RSS取得エラー:', e)
    return []
  }

  const candidates: CandidateURL[] = []
  const seen = new Set<string>()

  for (const item of feed.items ?? []) {
    const content =
      (item as Record<string, unknown>)['content:encoded'] as string ||
      item.contentSnippet ||
      item.summary ||
      ''

    if (!content) continue

    // HTML内の外部リンクを抽出
    const $ = load(content)
    const links: Array<{ url: string; priority: number; title: string }> = []

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? ''
      if (!href.startsWith('http')) return
      if (!isExternalUrl(href, 'prtimes.jp')) return

      // JP/グローバルドメインのみ
      try {
        const parsed = new URL(href)
        const tld = parsed.hostname.split('.').slice(-2).join('.')
        const isJpOrCom = tld.endsWith('.jp') || tld.endsWith('.com') || tld.endsWith('.co.jp')
        if (!isJpOrCom) return
      } catch {
        return
      }

      const cleanUrl = href.split('#')[0] // フラグメント除去
      if (seen.has(cleanUrl)) return
      seen.add(cleanUrl)

      links.push({
        url: cleanUrl,
        priority: prioritizeUrl(cleanUrl),
        title: $(el).text().trim() || item.title || '',
      })
    })

    // 優先度順にソートして追加
    links.sort((a, b) => b.priority - a.priority)
    for (const link of links.slice(0, 3)) { // 記事あたり最大3件
      candidates.push({
        url: link.url,
        source: SOURCE_NAME,
        title: link.title,
      })
    }

    // RSS上のリンク自体も候補
    if (item.link && isExternalUrl(item.link, 'prtimes.jp') && !seen.has(item.link)) {
      seen.add(item.link)
      candidates.push({
        url: item.link,
        source: SOURCE_NAME,
        title: item.title ?? '',
      })
    }
  }

  return candidates
}
