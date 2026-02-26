import { createServiceClient } from '@/lib/supabase'
import { processNewsletterArticle } from '@/lib/ai-client'
import { extractArticleContent } from '@/lib/article-extractor'
import { filterArticle } from '@/lib/article-filter'
import RSSParser from 'rss-parser'
import { fetchExternal } from '@/lib/http-client'

const parser = new RSSParser({ timeout: 10000 })

export interface NewsletterFetchResult {
  processed: number
  skipped: number
  errors: number
}

type DiscoveredArticle = { url: string; title: string }

async function fetchArticlesFromRSS(url: string): Promise<DiscoveredArticle[]> {
  const feed = await parser.parseURL(url)
  return feed.items.slice(0, 10).filter((item) => item.link).map((item) => ({
    url: item.link!,
    title: item.title ?? '',
  }))
}

async function fetchArticlesFromSitemap(url: string): Promise<DiscoveredArticle[]> {
  const xml = await (await fetchExternal(url)).text()
  const urls = Array.from(xml.matchAll(/<url>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?(?:<lastmod>(.*?)<\/lastmod>)?[\s\S]*?<\/url>/g))
  const now = Date.now()
  return urls
    .filter((m) => {
      const lastmod = m[2]
      if (!lastmod) return /\d{4}\/\d{2}\/\d{2}/.test(m[1])
      const diff = now - new Date(lastmod).getTime()
      return diff <= 14 * 24 * 60 * 60 * 1000
    })
    .slice(0, 10)
    .map((m) => ({ url: m[1], title: m[1].split('/').pop() ?? m[1] }))
}

async function fetchArticlesFromScrape(config?: Record<string, unknown>): Promise<DiscoveredArticle[]> {
  if (!config?.list_url || !config?.article_selector) return []
  const listUrl = String(config.list_url)
  const html = await (await fetchExternal(listUrl)).text()
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)).slice(0, 40)
  const discovered: DiscoveredArticle[] = []
  for (const link of links) {
    const url = new URL(link[1], listUrl).toString()
    const title = link[2].replace(/<[^>]+>/g, '').trim()
    if (title.length > 5) discovered.push({ url, title })
    if (discovered.length >= 10) break
  }
  return discovered
}

export async function runNewsletterFetch(): Promise<NewsletterFetchResult> {
  const supabase = createServiceClient({ requireServiceRole: true })
  const { data: sources, error: sourcesError } = await supabase.from('nl_sources').select('*').eq('active', true)

  if (sourcesError || !sources?.length) throw new Error('No active sources found')

  const results: NewsletterFetchResult = { processed: 0, skipped: 0, errors: 0 }

  for (const source of sources) {
    try {
      let discoveredArticles: DiscoveredArticle[] = []
      switch (source.type) {
        case 'rss':
        case 'substack':
          discoveredArticles = await fetchArticlesFromRSS(source.url)
          break
        case 'sitemap':
          discoveredArticles = await fetchArticlesFromSitemap(source.scrape_config?.sitemap_url ?? source.url)
          break
        case 'scrape':
          discoveredArticles = await fetchArticlesFromScrape(source.scrape_config)
          break
        default:
          discoveredArticles = await fetchArticlesFromRSS(source.url)
      }

      for (const article of discoveredArticles) {
        const { data: existing } = await supabase.from('nl_articles').select('id').eq('original_url', article.url).single()
        if (existing) {
          results.skipped++
          continue
        }

        let fullContent = article.title
        let extractionMethod = 'rss_fallback'

        try {
          const extracted = await extractArticleContent(article.url)
          fullContent = extracted.content
          extractionMethod = extracted.extractionMethod
        } catch (extractError) {
          console.error('extract failed', extractError)
        }

        const filterResult = filterArticle(article.title, fullContent)
        if (!filterResult.isRelevant) {
          await supabase.from('nl_articles').insert({
            source_id: source.id,
            original_url: article.url,
            original_title: article.title,
            original_content: fullContent.slice(0, 5000),
            content_length: fullContent.length,
            extraction_method: extractionMethod,
            status: 'auto_rejected',
          })
          results.skipped++
          continue
        }

        try {
          const aiResult = await processNewsletterArticle({
            original_title: article.title,
            original_content: fullContent,
          })

          await supabase.from('nl_articles').insert({
            source_id: source.id,
            original_url: article.url,
            original_title: article.title,
            original_content: fullContent.slice(0, 5000),
            summary_ja: aiResult.summary_ja,
            translated_title_ja: aiResult.translated_title_ja,
            key_insights: aiResult.key_insights,
            relevance_score: aiResult.relevance_score,
            evidence_level: aiResult.evidence_level,
            actionable_tips: aiResult.actionable_tips,
            content_length: fullContent.length,
            extraction_method: extractionMethod,
            status: 'pending',
          })
          results.processed++
        } catch (aiError) {
          console.error('AI processing failed', aiError)
          results.errors++
        }
      }

      await supabase.from('nl_sources').update({ last_fetched_at: new Date().toISOString() }).eq('id', source.id)
    } catch (sourceError) {
      console.error(`Failed to fetch source ${source.name}:`, sourceError)
      results.errors++
    }
  }

  return results
}
