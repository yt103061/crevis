import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { processNewsletterArticle } from '@/lib/ai-client'
import RSSParser from 'rss-parser'

const parser = new RSSParser({
  timeout: 10000,
})

export async function POST() {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // アクティブなソースを取得
  const { data: sources, error: sourcesError } = await supabase
    .from('nl_sources')
    .select('*')
    .eq('active', true)

  if (sourcesError || !sources?.length) {
    return NextResponse.json({ error: 'No active sources found' }, { status: 400 })
  }

  const results = { processed: 0, skipped: 0, errors: 0 }

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url)
      const items = feed.items.slice(0, 10) // 最新10件

      for (const item of items) {
        if (!item.link) continue

        // 既存チェック
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

        // AI処理
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

        // DB保存
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

      // ソースのlast_fetched_atを更新
      await supabase
        .from('nl_sources')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', source.id)
    } catch (sourceError) {
      console.error(`Failed to fetch source ${source.name}:`, sourceError)
      results.errors++
    }
  }

  return NextResponse.json({ results })
}
