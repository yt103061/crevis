import RSSParser from 'rss-parser'
import { analyzeLP } from '@/lib/ai-client'
import { createServiceClient } from '@/lib/supabase'
import { DEFAULT_LP_DISCOVERY_FEEDS, type LPDiscoveryFeed } from '@/lib/automation/default-feeds'

const parser = new RSSParser({
  timeout: 10000,
  customFields: {
    item: ['content:encoded'],
  },
})

export interface LPDiscoveryResult {
  discovered: number
  inserted: number
  analyzed: number
  activated: number
  skipped: number
  heuristic_skipped: number
  errors: number
  feed_errors: number
  feed_error_details: string[]
  /** AI分析に失敗したLPのURL＋エラーメッセージ */
  analysis_error_details: string[]
}

interface Candidate {
  url: string
  title?: string
  sourceName: string
  sourceWeight: number
  market: 'jp' | 'global'
}

function getFeedDefinitions(): LPDiscoveryFeed[] {
  const raw = process.env.LP_DISCOVERY_FEEDS ?? ''
  const feedsFromEnv = raw
    .split(',')
    .map((url) => url.trim())
    .filter((url) => !!url)

  if (feedsFromEnv.length > 0) {
    return feedsFromEnv.map((url) => {
      let host = 'custom'
      try {
        host = new URL(url).hostname
      } catch {
        host = 'custom'
      }
      return {
        name: `env:${host}`,
        url,
        type: 'direct' as const,
        market: 'jp' as const,
        weight: 20,
      }
    })
  }

  const allowDefaults = String(process.env.LP_DISCOVERY_USE_DEFAULT_FEEDS ?? 'true').toLowerCase() === 'true'
  return allowDefaults ? DEFAULT_LP_DISCOVERY_FEEDS : []
}

function normalizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.hash = ''

    const filtered = new URLSearchParams()
    url.searchParams.forEach((value, key) => {
      if (key.startsWith('utm_')) return
      if (key === 'fbclid' || key === 'gclid') return
      filtered.append(key, value)
    })
    url.search = filtered.toString() ? `?${filtered.toString()}` : ''

    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function isJapaneseCandidate(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('.jp') || parsed.pathname.includes('/jp/')
  } catch {
    return false
  }
}

function containsLpIntentKeyword(text: string): boolean {
  const s = text.toLowerCase()
  const keywords = ['lp', 'landing', 'campaign', 'trial', 'signup', 'register', 'contact', 'form', '資料請求', '申し込み', '申込', '無料', '導入', 'キャンペーン']
  return keywords.some((k) => s.includes(k))
}

function containsPerformanceSignal(text: string): boolean {
  const s = text.toLowerCase()
  const keywords = [
    'cvr',
    'cv',
    'roas',
    'roi',
    '売上',
    '成約',
    '導入実績',
    '利用社数',
    '累計',
    '達成',
    '改善',
    '成果',
    '実績',
    '比較',
    '事例',
  ]
  return keywords.some((k) => s.includes(k))
}

function heuristicScore(candidate: Candidate): number {
  let score = candidate.sourceWeight
  if (isJapaneseCandidate(candidate.url)) score += 24

  if (containsLpIntentKeyword(candidate.url)) score += 18
  if (candidate.title && containsLpIntentKeyword(candidate.title)) score += 16

  if (containsPerformanceSignal(candidate.url)) score += 10
  if (candidate.title && containsPerformanceSignal(candidate.title)) score += 16

  if (candidate.market === 'jp') score += 12
  if (candidate.url.includes('/lp') || candidate.url.includes('/campaign')) score += 8

  return score
}

/**
 * B3: LP候補のHTMLを取得し、「本当にLPか」スコアを算出する。
 *
 * 判定の考え方:
 * - LPの必要条件: フォーム要素（資料請求・申し込みフォーム等）が存在する
 *   → hasHardLpSignal が false かつ CTA が少ない場合は LP と見なさない
 * - ニュース・ブログ記事の特徴: <article>+<time>、リンク密度が高い
 *   → これらのシグナルで減点
 */
function scoreLpHtml(html: string): number {
  let score = 0
  const lower = html.toLowerCase()

  // フォーム・入力要素（強いLPシグナル）
  const hasForm = /<form[\s>]/i.test(html)
  const hasEmailInput = /<input[^>]+type=["']email["']/i.test(html)
  const hasSubmitInput = /<input[^>]+type=["']submit["']/i.test(html)

  if (hasForm) score += 30
  if (hasEmailInput) score += 20
  if (hasSubmitInput) score += 15

  // CTA系キーワード
  const ctaKeywords = [
    '申し込み', '資料請求', '無料', '登録', 'お問い合わせ', '今すぐ', '試す', 'ダウンロード',
    'trial', 'sign up', 'get started', 'contact', 'free', 'download', 'register', 'demo',
  ]
  const ctaHits = ctaKeywords.filter((k) => lower.includes(k)).length
  score += ctaHits * 6

  // noindex = 広告専用LP（SEOに出したくない高品質LP）
  const hasNoIndex = /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) ||
    /content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i.test(html)
  if (hasNoIndex) score += 40

  // 外部フォームサービスへのリンク検出（フォームタグ不要のLP）
  const externalFormDomains = [
    'formrun.me', 'form.run', 'tayori.com', 'typeform.com',
    'hubspot.com', 'hsforms.com', 'salesforce.com', 'pardot.com',
    'marketo.com', 'mailchimp.com', 'kintoneapp.com', 'google.com/forms',
    'docs.google.com/forms', 'calendly.com', 'lp.formzu.com',
  ]
  const hasExternalFormLink = externalFormDomains.some((domain) => lower.includes(domain))
  if (hasExternalFormLink) score += 25

  // ブログ記事・ニュースページ的シグナル（減点）
  if (/<article[\s>]/i.test(html) && /<time[\s>]/i.test(html)) score -= 30
  const articleCount = (html.match(/<article[\s>]/gi) ?? []).length
  if (articleCount > 3) score -= 25

  // リンク密度が高いページはポータル・ブログ（減点）
  const linkCount = (html.match(/<a\s[^>]*href/gi) ?? []).length
  if (linkCount > 80) score -= 20
  if (linkCount > 150) score -= 20

  // OGP/メタタグによるコンテンツタイプ判定（強い減点）
  if (/property=["']article:published_time["']/i.test(html)) score -= 40
  if (/property=["']article:author["']/i.test(html)) score -= 20
  if (/name=["']news_keywords["']/i.test(html)) score -= 40
  // JSON-LDでニュース記事・ブログ記事と明示されている場合
  if (/"@type"\s*:\s*["'](NewsArticle|Article|BlogPosting|Blog)["']/i.test(html)) score -= 40
  // 雑誌・メディア系ページのシグナル
  if (/class=["'][^"']*byline[^"']*["']/i.test(html)) score -= 20
  if (/class=["'][^"']*author[^"']*["']/i.test(html) && /<time[\s>]/i.test(html)) score -= 20

  // ゲート: フォーム要素・外部フォームリンクがなく CTA も少ない場合はLPではない
  // noindex付きのLPはフォームなしのケースがあるため免除
  const hasHardLpSignal = hasForm || hasEmailInput || hasSubmitInput || hasExternalFormLink
  if (hasNoIndex && ctaHits >= 2) return score  // noindex + CTA2件以上は確実にLP
  if (!hasHardLpSignal && ctaHits < 4) {
    return 0
  }

  return score
}

/** LPページのHTMLをGETで取得する。失敗時はnullを返す。 */
async function fetchLpHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0; +https://crevis.jp)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function extractLinksFromHtml(html: string): string[] {
  const links: string[] = []
  const regex = /href=["']([^"']+)["']/g
  let match
  while ((match = regex.exec(html)) !== null) {
    links.push(match[1])
  }
  return links
}



async function fetchFeedWithFallback(feed: LPDiscoveryFeed) {
  try {
    return await parser.parseURL(feed.url)
  } catch (primaryError) {
    try {
      const res = await fetch(feed.url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0; +https://crevis.jp)',
          accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const raw = await res.text()
      return await parser.parseString(raw)
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : 'unknown_feed_error'
      const primaryMessage = primaryError instanceof Error ? primaryError.message : 'unknown_primary_error'
      throw new Error(`${feed.name}: ${message} (primary: ${primaryMessage})`)
    }
  }
}

/**
 * LP候補として不適切なドメイン。
 * PR TIMESのプレスリリースページにはサイドバー・フッターに
 * パートナーサービスや外部サービスへのリンクが大量に含まれるため、
 * 既知の非LP系ドメインをここで除外する。
 */
const BLOCKED_DISCOVERY_DOMAINS = new Set([
  // PR TIMES本体および傘下・パートナーサービス
  'prtimes.jp', 'prtimes.co.jp',
  'preditor.prtimes.com',
  'tayori.com',
  'jooto.com',
  'predge.jp',
  // ソーシャルメディア
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'linkedin.com', 'youtube.com', 'tiktok.com',
  // ECプラットフォーム（商品ページはLPではない）
  'amazon.co.jp', 'amazon.com', 'rakuten.co.jp',
  // アプリストア
  'apps.apple.com', 'play.google.com', 'itunes.apple.com',
  // 計測・リダイレクト
  'app.adjust.com', 'bit.ly', 'ow.ly', 'lnkd.in',
  // コード・開発
  'github.com', 'github.io',
  // 日本のブログ・ノートプラットフォーム
  'note.com', 'hatenablog.com', 'hatena.ne.jp', 'qiita.com', 'zenn.dev',
  // グローバルブログプラットフォーム
  'medium.com', 'substack.com', 'wordpress.com', 'blogger.com',
  // 日本の主要ニュース・新聞社（記事ページはLPではない）
  'nikkei.com', 'asahi.com', 'yomiuri.co.jp', 'mainichi.jp', 'sankei.com',
  'jiji.com', 'kyodo.co.jp', 'nhk.or.jp', 'nhk.jp',
  // 日本の経済・ビジネス系メディア
  'toyokeizai.net', 'diamond.jp', 'president.jp', 'businessinsider.jp',
  'forbesjapan.com', 'fortune.com',
  // 日本のIT・テック系メディア
  'itmedia.co.jp', 'impress.co.jp', 'impressrd.jp', 'computerworld.jp',
  'zdnet.com', 'cnet.com', 'wired.com', 'wired.jp',
  // グローバルIT・テック系メディア
  'techcrunch.com', 'venturebeat.com', 'thebridge.jp',
  'theverge.com', 'engadget.com', 'mashable.com', 'gizmodo.com',
  // 日本のマーケ・ウェブ業界メディア（記事サイト）
  'webtan.impress.co.jp', 'markezine.jp', 'ferret-plus.com',
  'digiday.jp', 'liginc.co.jp',
  // 週刊誌・雑誌系
  'newsweekjapan.jp', 'newsweek.com', 'bunshun.jp', 'shueisha.co.jp',
  'kodansha.co.jp', 'kadokawa.co.jp',
  // Q&A・コミュニティ
  'stackoverflow.com', 'reddit.com', 'quora.com',
  'yahoo.co.jp', 'chiebukuro.yahoo.co.jp',
  // Wikipedia・辞典
  'wikipedia.org', 'ja.wikipedia.org',
])

/**
 * LP候補として不適切なURLパスのプレフィックス。
 * 法務ページ・お知らせページ・FAQ等はCRO分析対象のLPではない。
 */
const BLOCKED_PATH_PREFIXES = [
  '/policy', '/privacy', '/terms', '/legal', '/sitemap',
  '/notice/', '/faq', '/recruit', '/ir/',
  // メディア・雑誌・記事ページ
  '/magazine', '/magazine/', '/news/', '/article/', '/articles/',
  '/column/', '/columns/', '/release/', '/press/', '/press-release/',
  '/blog/', '/blogs/',
  // その他の非LPページ
  '/about', '/company', '/contact', '/support', '/help/',
  '/member/', '/mypage', '/cart', '/shop/',
]

async function extractCandidatesFromIntermediary(itemLink: string, feed: LPDiscoveryFeed): Promise<string[]> {
  try {
    const res = await fetch(itemLink, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const html = await res.text()

    let feedHost = ''
    try {
      feedHost = new URL(feed.url).hostname.replace(/^www\./, '')
    } catch {
      feedHost = ''
    }

    const base = new URL(itemLink)
    const rawLinks = extractLinksFromHtml(html)
    const normalized = rawLinks
      .map((href) => {
        try {
          return new URL(href, base).toString()
        } catch {
          return null
        }
      })
      .filter((u): u is string => !!u)
      .map((u) => normalizeUrl(u))
      .filter((u): u is string => !!u)
      .filter((u) => {
        try {
          const parsed = new URL(u)
          const host = parsed.hostname.replace(/^www\./, '')

          // ブロック対象ドメイン
          if (BLOCKED_DISCOVERY_DOMAINS.has(host) || BLOCKED_DISCOVERY_DOMAINS.has(parsed.hostname)) return false

          // フィード自身のドメインを除外（intermediaryサイト自身へのリンクを除く）
          if (feedHost && host.endsWith(feedHost)) return false

          // トップページ（パスなし・ルートのみ）はLPではなく会社トップページ
          if (parsed.pathname === '/' || parsed.pathname === '') return false

          // 法務・お知らせ・FAQ等の非LPページパターン
          const pathLower = parsed.pathname.toLowerCase()
          if (BLOCKED_PATH_PREFIXES.some((p) => pathLower.startsWith(p))) return false

          return true
        } catch {
          return false
        }
      })

    // 重複が多いのでユニーク化
    return Array.from(new Set(normalized))
  } catch (error) {
    console.error('Intermediary extraction failed:', feed.name, itemLink, error)
    return []
  }
}

async function collectCandidates(feed: LPDiscoveryFeed, item: { link?: string; title?: string }): Promise<Candidate[]> {
  if (!item.link) return []

  const candidates: Candidate[] = []
  if (feed.type === 'direct') {
    const normalized = normalizeUrl(item.link)
    if (!normalized) return []
    candidates.push({
      url: normalized,
      title: item.title,
      sourceName: feed.name,
      sourceWeight: feed.weight,
      market: feed.market,
    })
    return candidates
  }

  const extracted = await extractCandidatesFromIntermediary(item.link, feed)
  for (const url of extracted) {
    candidates.push({
      url,
      title: item.title,
      sourceName: feed.name,
      sourceWeight: feed.weight,
      market: feed.market,
    })
  }

  return candidates
}

export async function runLPDiscovery(): Promise<LPDiscoveryResult> {
  const feeds = getFeedDefinitions()
  if (!feeds.length) {
    throw new Error('LP discovery feeds are empty. Set LP_DISCOVERY_FEEDS or enable LP_DISCOVERY_USE_DEFAULT_FEEDS=true')
  }

  const perFeedLimit = Number(process.env.LP_DISCOVERY_LIMIT_PER_FEED ?? '5')
  const minScore = Number(process.env.LP_DISCOVERY_MIN_SCORE ?? '70')
  const minHeuristic = Number(process.env.LP_DISCOVERY_MIN_HEURISTIC_SCORE ?? '10')
  const minLpHtmlScore = Number(process.env.LP_HTML_MIN_SCORE ?? '45')
  // 1回の実行で新規挿入＋AI分析する上限。Gemini無料枠のレートリミット対策
  const maxNewPerRun = Number(process.env.LP_DISCOVERY_MAX_NEW_PER_RUN ?? '5')
  const jpOnly = String(process.env.LP_DISCOVERY_JP_ONLY ?? 'false').toLowerCase() === 'true'
  const requirePerformanceSignal = String(process.env.LP_DISCOVERY_REQUIRE_PERFORMANCE_SIGNAL ?? 'false').toLowerCase() === 'true'

  const supabase = createServiceClient({ requireServiceRole: true })
  const result: LPDiscoveryResult = {
    discovered: 0,
    inserted: 0,
    analyzed: 0,
    activated: 0,
    skipped: 0,
    heuristic_skipped: 0,
    errors: 0,
    feed_errors: 0,
    feed_error_details: [],
    analysis_error_details: [],
  }

  for (const feed of feeds) {
    try {
      const parsed = await fetchFeedWithFallback(feed)
      const items = parsed.items.slice(0, perFeedLimit)

      for (const item of items) {
        const candidates = await collectCandidates(feed, { link: item.link, title: item.title ?? undefined })
        for (const candidate of candidates) {
          result.discovered++

          if (jpOnly && !isJapaneseCandidate(candidate.url)) {
            result.heuristic_skipped++
            continue
          }

          const textForSignal = `${candidate.title ?? ''} ${candidate.url}`
          if (requirePerformanceSignal && !containsPerformanceSignal(textForSignal)) {
            result.heuristic_skipped++
            continue
          }

          const score = heuristicScore(candidate)
          if (score < minHeuristic) {
            result.heuristic_skipped++
            continue
          }

          const { data: existing } = await supabase
            .from('lps')
            .select('id')
            .eq('url', candidate.url)
            .maybeSingle()

          if (existing) {
            result.skipped++
            continue
          }

          // 1回の実行で挿入する上限に達したらそれ以降はスキップ
          if (result.inserted >= maxNewPerRun) {
            result.heuristic_skipped++
            continue
          }

          // B3: HTMLを取得してLP判定。ブログ記事等をAI分析前に除外する
          const html = await fetchLpHtml(candidate.url)
          if (!html) {
            result.skipped++
            continue
          }

          const lpHtmlScore = scoreLpHtml(html)
          if (lpHtmlScore < minLpHtmlScore) {
            result.heuristic_skipped++
            continue
          }

          const { data: lp, error: insertError } = await supabase
            .from('lps')
            .insert({
              url: candidate.url,
              title: candidate.title ?? null,
              status: 'archived',
              ad_platform: `auto_discovered:${candidate.sourceName}`,
            })
            .select()
            .single()

          if (insertError || !lp) {
            result.errors++
            continue
          }

          result.inserted++

          try {
            // A1: 事前取得済みHTMLをそのまま渡すことで再フェッチを回避
            // A3: LLMがindustry/purpose/target_audienceをページ内容から推論する
            const analysis = await analyzeLP({
              url: candidate.url,
              industry: '不明',
              purpose: '不明',
              target_audience: '不明',
              days_active: 30,
              rawHtml: html,
            })

            // lp_analysesにはinferred_*フィールドは不要なので除外して保存
            const {
              inferred_industry,
              inferred_purpose,
              inferred_target_audience,
              embedding,
              ...analysisData
            } = analysis

            const { error: analysisInsertError } = await supabase.from('lp_analyses').insert({
              lp_id: lp.id,
              ...analysisData,
              ...(embedding ? { embedding } : {}),
            })
            if (analysisInsertError) {
              // 分析データの保存失敗 → アクティベートせずエラー記録
              console.error('lp_analyses insert failed:', candidate.url, analysisInsertError.message)
              result.errors++
              result.analysis_error_details.push(`${candidate.url}: lp_analyses insert: ${analysisInsertError.message}`)
              continue
            }

            const shouldActivate = (analysis.total_score ?? 0) >= minScore

            // A3: 推論したメタデータをlpsテーブルに保存
            const { error: updateError } = await supabase
              .from('lps')
              .update({
                status: shouldActivate ? 'active' : 'archived',
                last_checked_at: new Date().toISOString(),
                ...(inferred_industry ? { industry: inferred_industry } : {}),
                ...(inferred_purpose ? { purpose: inferred_purpose } : {}),
                ...(inferred_target_audience ? { target_audience: inferred_target_audience } : {}),
              })
              .eq('id', lp.id)

            if (updateError) {
              console.error('lps status update failed:', candidate.url, updateError.message)
              result.errors++
              result.analysis_error_details.push(`${candidate.url}: lps update: ${updateError.message}`)
            }

            result.analyzed++
            if (shouldActivate && !updateError) result.activated++
          } catch (analysisError) {
            const msg = analysisError instanceof Error ? analysisError.message : 'unknown_error'
            console.error('LP analysis failed for discovered LP:', candidate.url, analysisError)
            result.errors++
            result.analysis_error_details.push(`${candidate.url}: ${msg}`)
          }
        }
      }
    } catch (feedError) {
      const message = feedError instanceof Error ? feedError.message : 'feed_fetch_failed'
      console.error('LP discovery feed fetch failed:', feed.url, feedError)
      result.errors++
      result.feed_errors++
      result.feed_error_details.push(message)
    }
  }

  return result
}
