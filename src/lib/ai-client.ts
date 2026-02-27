import type { LPAnalysisInput, LPAnalysisOutput, ArticleInput, ArticleOutput } from '@/types'
import { generateEmbedding } from '@/lib/embedding'

const AI_PROVIDER = process.env.AI_PROVIDER ?? 'gemini' // 'gemini' | 'claude'

export interface LPAnalysisWithEmbedding extends LPAnalysisOutput {
  embedding?: number[]
}

// LPページのHTMLから分析に必要なテキストを抽出する
export function extractPageText(html: string): string {
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? ''

  const metaDesc =
    (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+name=["']description["']/i))?.[1] ?? ''

  // H1-H3見出し（最大10件）
  const headings: string[] = []
  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi
  let m
  while ((m = headingRegex.exec(html)) !== null && headings.length < 10) {
    const text = m[1].replace(/<[^>]+>/g, '').trim()
    if (text) headings.push(text)
  }

  // ボタン・CTA（最大8件）
  const ctaTexts: string[] = []
  const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi
  while ((m = buttonRegex.exec(html)) !== null && ctaTexts.length < 8) {
    const text = m[1].replace(/<[^>]+>/g, '').trim()
    if (text) ctaTexts.push(text)
  }
  const inputRegex = /<input[^>]+>/gi
  while ((m = inputRegex.exec(html)) !== null && ctaTexts.length < 8) {
    const tag = m[0]
    if (/type=["'](submit|button)["']/i.test(tag)) {
      const valueMatch = tag.match(/value=["']([^"']+)["']/i)
      if (valueMatch) ctaTexts.push(valueMatch[1].trim())
    }
  }

  // 本文テキスト（script/style除去後、冒頭1000字）
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000)

  return [
    title ? `タイトル: ${title}` : '',
    metaDesc ? `説明: ${metaDesc}` : '',
    headings.length ? `見出し: ${headings.join(' / ')}` : '',
    ctaTexts.length ? `ボタン・CTA: ${ctaTexts.join(' / ')}` : '',
    bodyText ? `本文（冒頭）: ${bodyText}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

// LPページのHTMLを取得してテキストを抽出する（analyzeLP内でのフォールバック）
async function fetchPageContent(url: string): Promise<string> {
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
    if (!res.ok) return ''
    const html = await res.text()
    return extractPageText(html)
  } catch {
    return ''
  }
}

export async function analyzeLP(input: LPAnalysisInput): Promise<LPAnalysisWithEmbedding> {
  // 事前取得済みHTMLがあればそれを使い、なければここでフェッチ
  const pageContent = input.rawHtml
    ? extractPageText(input.rawHtml)
    : await fetchPageContent(input.url)

  const prompt = buildLPAnalysisPrompt(input, pageContent)
  const raw = AI_PROVIDER === 'claude'
    ? await callClaude(prompt)
    : await callGemini(prompt)
  const result = extractJSON(raw) as LPAnalysisWithEmbedding

  try {
    // 推論済みメタデータを優先してembeddingテキストを組み立てる
    const industry = result.inferred_industry ?? input.industry
    const purpose = result.inferred_purpose ?? input.purpose
    const target = result.inferred_target_audience ?? input.target_audience
    const embeddingText = `${industry} ${purpose} ${target} ${result.good_points?.join(' ')} ${result.why_it_works}`
    result.embedding = await generateEmbedding(embeddingText)
  } catch (err) {
    console.error('Embedding generation failed:', err)
  }

  return result
}

export async function processNewsletterArticle(
  input: ArticleInput
): Promise<ArticleOutput> {
  const prompt = buildArticlePrompt(input)
  const raw = AI_PROVIDER === 'claude'
    ? await callClaude(prompt)
    : await callGemini(prompt)
  return extractJSON(raw) as ArticleOutput
}

function buildLPAnalysisPrompt(input: LPAnalysisInput, pageContent: string): string {
  const contentSection = pageContent
    ? `\nページ内容:\n${pageContent}\n`
    : '\n（ページ内容の取得に失敗しました。URLから可能な範囲で推測してください）\n'

  // ページ構造情報をプロンプトに追加
  let structureSection = ''
  if (input.pageFeatures) {
    const f = input.pageFeatures
    structureSection = `
ページ構造情報（自動抽出）:
- LPらしさスコア: ${f.lpConfidenceScore}/100
- H1見出し: ${f.h1Text || '(なし)'}
- H2見出し: ${f.h2Texts.slice(0, 5).join(' / ') || '(なし)'}
- CTAボタン: ${f.ctaButtons.slice(0, 5).join(' / ') || '(なし)'}
- フォーム有無: ${f.hasMainForm ? `あり（${f.formFieldCount}フィールド）` : 'なし'}
- ナビリンク数: ${f.navLinkCount}
- ソーシャルプルーフ: ${f.hasSocialProof ? 'あり' : 'なし'}
- 口コミ/事例: ${f.hasTestimonials ? 'あり' : 'なし'}
- FAQ: ${f.hasFAQ ? 'あり' : 'なし'}
- 料金プラン: ${f.hasPricing ? 'あり' : 'なし'}
- 動画: ${f.hasVideo ? 'あり' : 'なし'}
- OGタイプ: ${f.ogType || '(未設定)'}
- メタ説明: ${f.metaDescription || '(なし)'}
`
  }

  return `以下のランディングページを分析し、JSON形式で返してください。

URL: ${input.url}
${contentSection}${structureSection}
業界・目的・ターゲットオーディエンスはページ内容から推論してください。

採点基準:
- structure_score: ファーストビュー・CTA配置・情報の流れの明確さ（0-100）
- copy_score: キャッチコピー・ベネフィット訴求・説得力（0-100）
- trust_score: 実績・口コミ・会社情報・セキュリティ表示等の信頼要素（0-100）
- longevity_score: 情報の鮮度・競合優位性・継続運用価値（0-100）
- total_score: 各スコアの加重平均による総合評価（0-100）

返却JSON形式:
{
  "inferred_industry": "推論した業界（例: SaaS/EC/人材/不動産/教育/医療/BtoB等）",
  "inferred_purpose": "推論した目的（例: 資料請求/無料トライアル/問い合わせ/購入/会員登録等）",
  "inferred_target_audience": "推論したターゲット（例: 中小企業経営者/Webマーケター/個人ユーザー等）",
  "structure_score": 0-100,
  "copy_score": 0-100,
  "trust_score": 0-100,
  "longevity_score": 0-100,
  "total_score": 0-100,
  "good_points": ["強み1", "強み2", "強み3"],
  "improvement_points": ["改善点1", "改善点2"],
  "why_it_works": "このLPが効果的な理由の説明",
  "target_match": "ターゲットとの適合度評価"
}

JSONのみを返してください。説明文は不要です。`
}

function buildArticlePrompt(input: ArticleInput): string {
  return `あなたはCRO（コンバージョン率最適化）とUX設計の専門家として、以下の記事を分析してください。
あなたは日本のWebマーケター・LP制作者・Webデザイナー向けの高品質なニュースレターを執筆しており、ニールセン・ノーマン・グループやCXLのニュースレターに匹敵する深度の洞察を提供する役割を担っています。

【記事情報】
タイトル: ${input.original_title}
本文:
${input.original_content.slice(0, 8000)}

【分析指針】
単なる情報の要約ではなく、「なぜこれが重要か」「従来の通説と何が違うか」「日本のLP現場でどう解釈すべきか」を専門家の視点で深掘りしてください。

■ summary_ja（450〜600字）:
記事の核心的な発見・主張を、背景・意義・示唆も含めて解説する。数値やデータは具体的に引用する。
「この研究が興味深いのは〜」「見落とされがちなポイントは〜」「従来の定説に対して〜」といった専門家コメンタリーを加え、情報の意味を能動的に解釈して書く。単なる事実列挙ではなく編集的視点を持つこと。

■ key_insights（4〜6件、各インサイトは50〜100字の1〜2文）:
表面的な事実の裏にある意味・構造・因果関係を掘り下げる。
「〜だから〜が成立する」「〜という誤解が多いが実際は〜」「〜のケースに限定すると〜」という形で、なぜそうなのかの理由・背景まで言及する。可能な場合は記事内の数値や実験を引用する。

■ actionable_tips（3〜5件）:
日本のLPやWebサイトで明日から実施できる具体的な施策。「〇〇セクションで〜を試す」「ABテスト仮説として〜を設定する」「〜というコピーパターンを採用する」など、どのページ要素に・どう適用するかを明記する。汎用的なアドバイスは避け、LP制作・CROの現場に直結させる。

■ relevance_score採点基準（CRO/LP改善への関連性）:
- 80-100: 直接役立つ（CVR改善・A/Bテスト・LPコピーライティング・フォーム最適化・ヒートマップ・ユーザー行動分析・説得デザイン等）
- 50-79: 間接的に参考になる（一般UX設計・マーケ戦略・説得心理学・データ分析・SEO・コンテンツ戦略等）
- 0-49: 関連性が低い（一般ニュース・無関係な技術・企業プレスリリース・業界動向一般等）

■ evidence_level基準:
- "high": 統計データ・実験結果・査読論文・大規模調査あり
- "medium": 事例研究・専門家意見・限定的データあり
- "low": 意見・推測・一般論のみ

返却JSON形式:
{
  "translated_title_ja": "日本語タイトル（原題のニュアンスを活かしつつ自然な日本語に）",
  "summary_ja": "450〜600字の深い専門家分析",
  "key_insights": ["インサイト1（50〜100字）", "インサイト2", "インサイト3", "インサイト4"],
  "relevance_score": 0-100,
  "evidence_level": "high" | "medium" | "low",
  "actionable_tips": ["具体的施策1", "施策2", "施策3"]
}

JSONのみを返してください。説明文は不要です。`
}

// Gemini 2.5 Flash（無料枠）
async function callGemini(prompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

// Claude claude-sonnet-4-20250514（Phase 2移行先）
async function callClaude(prompt: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })
  return (message.content[0] as { text: string }).text
}

function extractJSON(raw: string): unknown {
  // JSONブロックを抽出（```json ... ``` または裸のJSON）
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1].trim())
  }
  // 直接JSONを解析
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    return JSON.parse(raw.slice(start, end + 1))
  }
  return JSON.parse(raw)
}
