import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { analyzeLP, processNewsletterArticle } from '@/lib/ai-client'
import RSSParser from 'rss-parser'

const SAMPLE_LPS = [
  {
    url: 'https://www.shopify.com/jp',
    industry: 'IT・SaaS',
    purpose: '会員登録',
    target_audience: 'EC事業者・オンラインショップ運営者',
    ad_platform: 'google',
  },
  {
    url: 'https://studio.design/ja',
    industry: 'IT・SaaS',
    purpose: '会員登録',
    target_audience: 'Webデザイナー・ノーコード制作者',
    ad_platform: '',
  },
  {
    url: 'https://www.canva.com/ja_jp/',
    industry: 'IT・SaaS',
    purpose: '会員登録',
    target_audience: 'デザイナー・マーケター・個人事業主',
    ad_platform: 'meta',
  },
  {
    url: 'https://www.freee.co.jp/',
    industry: '金融・保険',
    purpose: 'リード獲得',
    target_audience: '中小企業経営者・個人事業主',
    ad_platform: 'google',
  },
  {
    url: 'https://note.com/',
    industry: 'IT・SaaS',
    purpose: '会員登録',
    target_audience: 'クリエイター・ライター・ブロガー',
    ad_platform: '',
  },
]

const SAMPLE_SOURCES = [
  {
    name: 'ConversionXL',
    url: 'https://cxl.com/blog/feed/',
    type: 'rss',
    language: 'en',
  },
  {
    name: 'Nielsen Norman Group',
    url: 'https://www.nngroup.com/feed/rss/',
    type: 'rss',
    language: 'en',
  },
  {
    name: 'Unbounce Blog',
    url: 'https://unbounce.com/blog/feed/',
    type: 'rss',
    language: 'en',
  },
]

export async function POST() {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = { lps: { created: 0, analyzed: 0, errors: 0 }, sources: { created: 0 }, articles: { processed: 0, errors: 0 } }

  // 1. LP登録 + AI分析
  for (const lp of SAMPLE_LPS) {
    try {
      const { data: existing } = await supabase
        .from('lps')
        .select('id')
        .eq('url', lp.url)
        .single()

      if (existing) continue

      const { data: inserted, error: insertError } = await supabase
        .from('lps')
        .insert({
          url: lp.url,
          industry: lp.industry,
          purpose: lp.purpose,
          target_audience: lp.target_audience,
          ad_platform: lp.ad_platform || null,
          status: 'active',
        })
        .select()
        .single()

      if (insertError) {
        console.error('LP insert error:', insertError)
        results.lps.errors++
        continue
      }

      results.lps.created++

      try {
        const analysis = await analyzeLP({
          url: lp.url,
          industry: lp.industry,
          purpose: lp.purpose,
          target_audience: lp.target_audience,
          days_active: 30,
        })

        await supabase.from('lp_analyses').insert({
          lp_id: inserted.id,
          ...analysis,
        })

        results.lps.analyzed++
      } catch (aiError) {
        console.error('AI analysis failed for:', lp.url, aiError)
        results.lps.errors++
      }
    } catch (err) {
      console.error('LP seed error:', err)
      results.lps.errors++
    }
  }

  // 2. NLソース登録
  for (const source of SAMPLE_SOURCES) {
    try {
      const { data: existing } = await supabase
        .from('nl_sources')
        .select('id')
        .eq('url', source.url)
        .single()

      if (existing) continue

      await supabase.from('nl_sources').insert(source)
      results.sources.created++
    } catch {
      // skip
    }
  }

  // 3. 記事収集（最初の2ソースから各3件）
  const parser = new RSSParser({ timeout: 10000 })
  const { data: sources } = await supabase
    .from('nl_sources')
    .select('*')
    .eq('active', true)
    .limit(2)

  if (sources) {
    for (const source of sources) {
      try {
        const feed = await parser.parseURL(source.url)
        const items = feed.items.slice(0, 3)

        for (const item of items) {
          if (!item.link) continue

          const { data: existing } = await supabase
            .from('nl_articles')
            .select('id')
            .eq('original_url', item.link)
            .single()

          if (existing) continue

          const content = item.contentSnippet ?? item.content ?? item.summary ?? ''

          try {
            const aiResult = await processNewsletterArticle({
              original_title: item.title ?? '',
              original_content: content,
            })

            await supabase.from('nl_articles').insert({
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

            results.articles.processed++
          } catch {
            results.articles.errors++
          }
        }

        await supabase
          .from('nl_sources')
          .update({ last_fetched_at: new Date().toISOString() })
          .eq('id', source.id)
      } catch (err) {
        console.error('RSS fetch error:', err)
        results.articles.errors++
      }
    }
  }

  return NextResponse.json({
    message: 'シードデータの登録が完了しました',
    results,
  })
}
