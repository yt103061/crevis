import { fetchExternal } from '@/lib/http-client'

export interface ExtractedArticle {
  title: string
  content: string
  contentLength: number
  publishedDate: string | null
  author: string | null
  extractionMethod: 'article-tag' | 'main-tag' | 'role-main' | 'largest-block' | 'body-fallback'
}

function stripTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickBlock(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern)
  return match?.[1] ? stripTags(match[1]) : null
}

function largestDiv(html: string): string {
  const blocks = Array.from(html.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/gi)).map((m) => stripTags(m[1]))
  return blocks.sort((a, b) => b.length - a.length)[0] ?? ''
}

export async function extractArticleContent(url: string): Promise<ExtractedArticle> {
  const html = await (await fetchExternal(url)).text()
  const title = pickBlock(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? ''
  const author = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null
  const publishedDate = html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] ?? null

  let content = pickBlock(html, /<article[^>]*>([\s\S]*?)<\/article>/i)
  let extractionMethod: ExtractedArticle['extractionMethod'] = 'article-tag'

  if (!content || content.length < 300) {
    content = pickBlock(html, /<main[^>]*>([\s\S]*?)<\/main>/i)
    extractionMethod = 'main-tag'
  }
  if (!content || content.length < 300) {
    content = pickBlock(html, /<[^>]+role=["']main["'][^>]*>([\s\S]*?)<\/[^>]+>/i)
    extractionMethod = 'role-main'
  }
  if (!content || content.length < 300) {
    content = largestDiv(html)
    extractionMethod = 'largest-block'
  }
  if (!content || content.length < 300) {
    const body = pickBlock(html, /<body[^>]*>([\s\S]*?)<\/body>/i) ?? ''
    content = body
      .replace(/\b(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, ' ')
      .trim()
    extractionMethod = 'body-fallback'
  }

  const trimmed = content.slice(0, 5000)
  return {
    title,
    content: trimmed,
    contentLength: trimmed.length,
    publishedDate,
    author,
    extractionMethod,
  }
}
