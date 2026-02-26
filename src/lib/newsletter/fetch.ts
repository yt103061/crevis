import { createServiceClient } from '@/lib/supabase'
import { processNewsletterArticle } from '@/lib/ai-client'
import { extractArticleText } from '@/lib/article-extractor'
import { filterArticle, AUTO_REJECT_SCORE_THRESHOLD } from '@/lib/article-filter'
import { acquireRateLimit, extractDomain } from '@/lib/rate-limiter'
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
  autoRejected: number
  /** フェッチに失敗したソースの詳細（"ソース名: エラー内容" 形式） */
  source_error_details: string[]
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

  const results: NewsletterFetchResult = {
    processed: 0,
    skipped: 0,
    errors: 0,
    sourceErrors: 0,
    aiFallbacks: 0,
    autoRejected: 0,
    source_error_details: [],
  }

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

        const rssContent = item.contentSnippet ?? (item as { 'content:encoded'?: string })['content:encoded'] ?? item.content ?? item.summary ?? ''
        const title = item.title ?? ''

        // Stage 1: 事前フィルタリング（明らかに無関係な記事を除外）
        const filterResult = filterArticle(title, rssContent)
        if (!filterResult.pass) {
          // 自動却下（DBには保存してトレース可能にする）
          await supabase.from('nl_articles').insert({
            source_id: source.id,
            original_url: normalizedLink,
            original_title: title,
            original_content: rssContent.slice(0, 1000),
            status: 'auto_rejected',
            relevance_score: 0,
            extraction_method: 'rss',
            content_length: rssContent.length,
          })
          results.autoRejected++
          continue
        }

        // Stage 2: フルテキスト抽出（レートリミット適用）
        const domain = extractDomain(normalizedLink)
        await acquireRateLimit(domain, 5)

        const extracted = await extractArticleText(normalizedLink, rssContent)
        const content = extracted.text || rssContent

        // Stage 3: AI処理
        let aiResult: {
          summary_ja: string | null
          translated_title_ja: string | null
          key_insights: string[]
          relevance_score: number | null
          evidence_level: 'high' | 'medium' | 'low' | null
          actionable_tips: string[] | null
        }
        try {
          const rawResult = await processNewsletterArticle({
            original_title: title,
            original_content: content,
          })
          aiResult = {
            ...rawResult,
            evidence_level: rawResult.evidence_level ?? null,
            actionable_tips: rawResult.actionable_tips ?? null,
          }
        } catch (aiError) {
          console.error('AI processing failed for:', normalizedLink, aiError)
          results.aiFallbacks++
          aiResult = {
            summary_ja: null,
            translated_title_ja: null,
            key_insights: [],
            relevance_score: null,
            evidence_level: null,
            actionable_tips: null,
          }
        }

        // Stage 4: DB保存
        // スコアが低い場合は auto_rejected として保存
        const status =
          aiResult.relevance_score !== null && aiResult.relevance_score < AUTO_REJECT_SCORE_THRESHOLD
            ? 'auto_rejected'
            : 'pending'

        if (status === 'auto_rejected') {
          results.autoRejected++
        }

        const { error: insertError } = await supabase.from('nl_articles').insert({
          source_id: source.id,
          original_url: normalizedLink,
          original_title: title,
          original_content: content.slice(0, 5000),
          summary_ja: aiResult.summary_ja,
          translated_title_ja: aiResult.translated_title_ja,
          key_insights: aiResult.key_insights,
          relevance_score: aiResult.relevance_score,
          evidence_level: aiResult.evidence_level,
          actionable_tips: aiResult.actionable_tips,
          content_length: content.length,
          extraction_method: extracted.method,
          status,
        })

        if (insertError) {
          console.error('Failed to insert article:', insertError)
          results.errors++
        } else {
          if (status === 'pending') results.processed++
        }
      }

      await supabase
        .from('nl_sources')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', source.id)
    } catch (sourceError) {
      const msg = sourceError instanceof Error ? sourceError.message : 'unknown_error'
      console.error(`Failed to fetch source ${source.name}:`, sourceError)
      results.errors++
      results.sourceErrors++
      results.source_error_details.push(`${source.name}: ${msg}`)
    }
  }

  return results
}
