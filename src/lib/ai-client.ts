import type { LPAnalysisInput, LPAnalysisOutput, ArticleInput, ArticleOutput, LPPageFeatures } from '@/types'
import { generateEmbedding } from '@/lib/embedding'

const AI_PROVIDER = process.env.AI_PROVIDER ?? 'gemini'

export interface LPAnalysisWithEmbedding extends LPAnalysisOutput {
  embedding?: number[]
}

export async function analyzeLP(input: LPAnalysisInput, features?: LPPageFeatures): Promise<LPAnalysisWithEmbedding> {
  const prompt = features
    ? buildLPAnalysisPrompt(input, features)
    : buildLPAnalysisPromptLegacy(input)

  const raw = AI_PROVIDER === 'claude' ? await callClaude(prompt) : await callGemini(prompt)
  const result = extractJSON(raw) as LPAnalysisWithEmbedding

  try {
    const embeddingText = `${input.industry} ${input.purpose} ${input.target_audience} ${result.good_points?.join(' ')} ${result.why_it_works}`
    result.embedding = await generateEmbedding(embeddingText)
  } catch (err) {
    console.error('Embedding generation failed:', err)
  }

  return result
}

export async function processNewsletterArticle(input: ArticleInput): Promise<ArticleOutput> {
  const prompt = buildArticlePrompt(input)
  const raw = AI_PROVIDER === 'claude' ? await callClaude(prompt) : await callGemini(prompt)
  return extractJSON(raw) as ArticleOutput
}

function buildLPAnalysisPromptLegacy(input: LPAnalysisInput): string {
  return `以下のランディングページ情報を分析し、JSON形式で返してください。

URL: ${input.url}
業界: ${input.industry}
目的: ${input.purpose}
ターゲット: ${input.target_audience}
推定稼働日数: ${input.days_active}

返却JSON形式:
{
  "structure_score": 0-100,
  "copy_score": 0-100,
  "trust_score": 0-100,
  "longevity_score": 0-100,
  "total_score": 0-100,
  "good_points": ["...", "...", "..."],
  "improvement_points": ["...", "..."],
  "why_it_works": "...",
  "target_match": "..."
}

JSONのみを返してください。説明文は不要です。`
}

function buildLPAnalysisPrompt(input: LPAnalysisInput, features: LPPageFeatures): string {
  return `以下のランディングページの構造データを分析し、JSON形式でスコアと評価を返してください。

## 基本情報
- URL: ${input.url}
- 業界: ${input.industry}
- 目的: ${input.purpose}
- ターゲット: ${input.target_audience}
- 推定稼働日数: ${input.days_active}

## ページ構造（自動解析結果）
- ページタイトル: ${features.metaTitle}
- H1: ${features.h1Text}
- H2一覧: ${features.h2Texts.join('\n')}
- meta description: ${features.metaDescription}
- セクション数: ${features.totalSections}
- ナビリンク数: ${features.navLinkCount}
- CTAボタンテキスト: ${features.ctaButtons.join('\n')}
- フォームフィールド数: ${features.formFieldCount}
- 画像数: ${features.totalImageCount}
- 動画埋め込み: ${features.hasVideo}

## コピー・訴求内容（セクション別抜粋）
${features.mainCopySnippets.map((snippet, index) => `${index + 1}. ${snippet}`).join('\n')}

## 信頼要素
- 実績/ロゴ表示: ${features.hasSocialProof}
- お客様の声: ${features.hasTestimonials}
- FAQ: ${features.hasFAQ}
- 料金表示: ${features.hasPricing}

## 評価指針
- structure_score: セクション構成、情報の流れ、CTA配置の適切さ
- copy_score: H1/H2の訴求力、ターゲットとの整合性、ベネフィット明示度
- trust_score: 社会的証明、具体性、第三者評価の有無
- longevity_score: 推定稼働日数に基づく市場検証度（長期稼働=成果が出ている可能性）

返却JSON形式:
{
  "structure_score": 0-100,
  "copy_score": 0-100,
  "trust_score": 0-100,
  "longevity_score": 0-100,
  "total_score": 0-100,
  "good_points": ["...", "...", "..."],
  "improvement_points": ["...", "..."],
  "why_it_works": "このLPが成果を出していると推定される理由を3〜5文で",
  "target_match": "ターゲットとの整合性評価を2〜3文で"
}

JSONのみを返してください。説明文は不要です。`
}

function buildArticlePrompt(input: ArticleInput): string {
  return `以下の英語記事を日本のWebデザイナー・Webマーケターが実務で活かせる形に日本語で要約してください。

## 記事情報
タイトル: ${input.original_title}
本文（全文または抜粋）:
---
${input.original_content.slice(0, 5000)}
---

## 要約のガイドライン
- 単なる翻訳ではなく、日本のLP制作・改善の文脈に落とし込んだ要約を作成
- 抽象的な概念は、日本の制作現場で使える具体的なアクションに変換
- 数値データ（CVR改善率など）があれば必ず含める
- 元記事の主張のエビデンスレベル（RCT、ケーススタディ、専門家意見など）も評価

返却JSON形式:
{
  "translated_title_ja": "日本のデザイナーが読みたくなるタイトル",
  "summary_ja": "300〜500字の要約。実務ポイント中心。",
  "key_insights": ["具体的で実行可能な示唆1", "示唆2", "示唆3"],
  "relevance_score": 0-100,
  "evidence_level": "high|medium|low",
  "actionable_tips": ["明日からできるアクション1", "アクション2"]
}

JSONのみを返してください。説明文は不要です。`
}

async function callGemini(prompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

async function callClaude(prompt: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })
  return (message.content[0] as { text: string }).text
}

function extractJSON(raw: string): unknown {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) return JSON.parse(jsonMatch[1].trim())
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1) return JSON.parse(raw.slice(start, end + 1))
  return JSON.parse(raw)
}
