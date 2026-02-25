import { createServiceClient } from '@/lib/supabase'
import { processNewsletterArticle } from '@/lib/ai-client'
import RSSParser from 'rss-parser'
import { DEFAULT_NL_SOURCES } from '@/lib/automation/default-feeds'

const parser = new RSSParser({
  timeout: 10000,
  customFields: { item: ['content:encoded'] },
})

export interface NewsletterFetchResult {
  processed: number
  skipped: number
  errors: number
  sourceErrors: number
  aiFallbacks: number
}



async function parseFeedWithFallback(url: string) {
  try {
    return await parser.parseURL(url)
  } catch (primaryError) {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0; +https://crevis.jp)',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      const msg = primaryError instanceof Error ? primaryError.message : 'feed_parse_failed'
      throw new Error(`HTTP ${res.status} (primary: ${msg})`)
    }
    const raw = await res.text()
    return await parser.parseString(raw)
  }
}

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return raw.trim().replace(/\/$/, '')
  }
}

// 以前のデフォルトに含まれていたが現在は廃止されたソースURL
// これらはDB内に残っている場合があるため、自動的に無効化する
const RETIRED_NL_SOURCE_URLS = [
  'https://prtimes.jp/technology/rss.xml',
  'https://prtimes.jp/internet/rss.xml',
]

async function ensureDefaultSources() {
  const supabase = createServiceClient({ requireServiceRole: true })

  const { data: existingSources, error } = await supabase
    .from('nl_sources')
    .select('id, url, active')

  if (error) {
    throw new Error(`Failed to load sources: ${error.message}`)
  }

  const byUrl = new Map((existingSources ?? []).map((s) => [normalizeUrl(s.url ?? ''), s]))

  let seeded = 0
  let reactivated = 0
  let retired = 0

  // 廃止されたソースを無効化
  for (const retiredUrl of RETIRED_NL_SOURCE_URLS) {
    const key = normalizeUrl(retiredUrl)
    const existing = byUrl.get(key)
    if (existing?.active) {
      await supabase
        .from('nl_sources')
        .update({ active: false })
        .eq('id', existing.id)
      retired++
    }
  }

  for (const source of DEFAULT_NL_SOURCES) {
    const key = normalizeUrl(source.url)
    const existing = byUrl.get(key)

    if (existing?.active) continue

    if (existing && !existing.active) {
      const { error: reactivateError } = await supabase
        .from('nl_sources')
        .update({ active: true, name: source.name, type: 'rss' })
        .eq('id', existing.id)

      if (!reactivateError) {
        reactivated++
      }
      continue
    }

    const { error: insertError } = await supabase.from('nl_sources').insert({
      name: source.name,
      url: source.url,
      type: 'rss',
      language: source.name.match(/[ぁ-んァ-ヶ一-龥]/) ? 'ja' : 'en',
      active: true,
    })

    if (!insertError) {
      seeded++
    }
  }

  return { seeded, reactivated, retired }
}

export async function runNewsletterFetch(): Promise<NewsletterFetchResult> {
  const autoSeed = String(process.env.NL_FETCH_AUTO_SEED_SOURCES ?? 'true').toLowerCase() === 'true'
  const seedOnEmptyOnly = String(process.env.NL_FETCH_AUTO_SEED_ON_EMPTY_ONLY ?? 'false').toLowerCase() === 'true'

  const supabase = createServiceClient({ requireServiceRole: true })

  const { data: beforeSources, error: beforeError } = await supabase
    .from('nl_sources')
    .select('id')
    .eq('active', true)

  if (beforeError) {
    throw new Error(beforeError.message)
  }

  if (autoSeed && (!seedOnEmptyOnly || (beforeSources?.length ?? 0) === 0)) {
    await ensureDefaultSources()
  }

  const { data: sources, error: sourcesError } = await supabase
    .from('nl_sources')
    .select('*')
    .eq('active', true)

  if (sourcesError || !sources?.length) {
    throw new Error('No active sources found')
  }

  const results: NewsletterFetchResult = { processed: 0, skipped: 0, errors: 0, sourceErrors: 0, aiFallbacks: 0 }

  for (const source of sources) {
    try {
      const feed = await parseFeedWithFallback(source.url)
      const items = feed.items.slice(0, 10)

      for (const item of items) {
        if (!item.link) continue

        const normalizedLink = normalizeUrl(item.link)
        const { data: existing } = await supabase
          .from('nl_articles')
          .select('id')
          .eq('original_url', normalizedLink)
          .maybeSingle()

        if (existing) {
          results.skipped++
          continue
        }

        const content = item.contentSnippet ?? (item as { 'content:encoded'?: string })['content:encoded'] ?? item.content ?? item.summary ?? ''

        let aiResult: {
          summary_ja: string | null
          translated_title_ja: string | null
          key_insights: string[]
          relevance_score: number | null
        }
        try {
          aiResult = await processNewsletterArticle({
            original_title: item.title ?? '',
            original_content: content,
          })
        } catch (aiError) {
          console.error('AI processing failed for:', normalizedLink, aiError)
          results.aiFallbacks++
          aiResult = {
            summary_ja: null,
            translated_title_ja: null,
            key_insights: [],
            relevance_score: null,
          }
        }

        const { error: insertError } = await supabase.from('nl_articles').insert({
          source_id: source.id,
          original_url: normalizedLink,
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
      results.sourceErrors++
    }
  }

  return results
}
