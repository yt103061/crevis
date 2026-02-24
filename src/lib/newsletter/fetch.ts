import { createServiceClient } from '@/lib/supabase'
import { processNewsletterArticle } from '@/lib/ai-client'
import RSSParser from 'rss-parser'

const parser = new RSSParser({
  timeout: 10000,
})

export interface NewsletterFetchResult {
  processed: number
  skipped: number
  errors: number
}

export async function runNewsletterFetch(): Promise<NewsletterFetchResult> {
  const supabase = createServiceClient()

  const { data: sources, error: sourcesError } = await supabase
    .from('nl_sources')
    .select('*')
    .eq('active', true)

  if (sourcesError || !sources?.length) {
    throw new Error('No active sources found')
  }

  const results: NewsletterFetchResult = { processed: 0, skipped: 0, errors: 0 }

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url)
      const items = feed.items.slice(0, 10)

      for (const item of items) {
        if (!item.link) continue

        const { data: existing } = await supabase
          .from('nl_articles')
          .select('id')
          .eq('original_url', item.link)
          .single()

        if (existing) {
          results.skipped++
          continue
        }

        const content = item.contentSnippet ?? item.content ?? item.summary ?? ''

        let aiResult
        try {
          aiResult = await processNewsletterArticle({
            original_title: item.title ?? '',
            original_content: content,
          })
        } catch (aiError) {
          console.error('AI processing failed for:', item.link, aiError)
          results.errors++
          continue
        }

        const { error: insertError } = await supabase.from('nl_articles').insert({
          source_id: source.id,
          original_url: item.link,
          original_title: item.title ?? '',
          original_content: content.slice(0, 5000),
          summary_ja: aiResult.summary_ja,
          translated_title_ja: aiResult.translated_title_ja,
          key_insights: aiResult.key_insights,
          relevance_score: aiResult.relevance_score,
          status: 'pending',
        })

        if (insertError) {
          console.error('Failed to insert article:', insertError)
          results.errors++
        } else {
          results.processed++
        }
      }

      await supabase
        .from('nl_sources')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', source.id)
    } catch (sourceError) {
      console.error(`Failed to fetch source ${source.name}:`, sourceError)
      results.errors++
    }
  }

  return results
}
