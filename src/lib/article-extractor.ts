/**
 * 記事フルテキスト抽出モジュール
 * RSSのサマリーではなく、元URLから本文テキストを取得する
 */

import * as cheerio from 'cheerio'

/** 記事本文として使いやすいセレクター（優先度順） */
const CONTENT_SELECTORS = [
  'article',
  '[class*="article-body"]',
  '[class*="post-body"]',
  '[class*="entry-content"]',
  '[class*="content-body"]',
  '[class*="article-content"]',
  '.content',
  'main',
]

/** 除去するノイズ要素 */
const NOISE_SELECTORS = [
  'script', 'style', 'noscript',
  'nav', 'header', 'footer',
  '[class*="sidebar"]', '[class*="related"]', '[class*="recommend"]',
  '[class*="ad"]', '[class*="banner"]',
  '[class*="comment"]', '[class*="share"]',
  '[class*="social"]', '[class*="newsletter"]',
  '[class*="subscribe"]',
]

export interface ExtractionResult {
  text: string
  wordCount: number
  method: 'scrape' | 'rss'
}

/**
 * URLから記事本文テキストを抽出する
 * 失敗した場合は空文字を返す
 */
export async function extractArticleText(url: string, fallbackContent?: string): Promise<ExtractionResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0; +https://crevis.jp)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      return fallbackToRss(fallbackContent)
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      return fallbackToRss(fallbackContent)
    }

    const html = await res.text()
    const text = extractFromHtml(html)

    if (text.length < 200) {
      // 抽出失敗 → RSSフォールバック
      return fallbackToRss(fallbackContent)
    }

    return {
      text,
      wordCount: text.length,
      method: 'scrape',
    }
  } catch {
    return fallbackToRss(fallbackContent)
  }
}

/**
 * HTMLから本文テキストを抽出する（cheerio使用）
 */
function extractFromHtml(html: string): string {
  const $ = cheerio.load(html)

  // ノイズ要素を削除
  NOISE_SELECTORS.forEach((sel) => $(sel).remove())

  // 本文コンテナを探す
  for (const selector of CONTENT_SELECTORS) {
    const el = $(selector).first()
    if (el.length) {
      const text = el.text().replace(/\s+/g, ' ').trim()
      if (text.length > 200) {
        return text.slice(0, 8000)
      }
    }
  }

  // フォールバック: body全体
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  return bodyText.slice(0, 8000)
}

function fallbackToRss(content?: string): ExtractionResult {
  const text = content?.trim() ?? ''
  return {
    text,
    wordCount: text.length,
    method: 'rss',
  }
}
