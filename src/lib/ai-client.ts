import type { LPAnalysisInput, LPAnalysisOutput, ArticleInput, ArticleOutput } from '@/types'

const AI_PROVIDER = process.env.AI_PROVIDER ?? 'gemini' // 'gemini' | 'claude'

export async function analyzeLP(input: LPAnalysisInput): Promise<LPAnalysisOutput> {
  const prompt = buildLPAnalysisPrompt(input)
  const raw = AI_PROVIDER === 'claude'
    ? await callClaude(prompt)
    : await callGemini(prompt)
  return extractJSON(raw) as LPAnalysisOutput
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

function buildLPAnalysisPrompt(input: LPAnalysisInput): string {
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

function buildArticlePrompt(input: ArticleInput): string {
  return `以下の英語記事を日本のデザイナー・Webマーケター向けに日本語で要約してください。

タイトル: ${input.original_title}
本文: ${input.original_content.slice(0, 3000)}

返却JSON形式:
{
  "translated_title_ja": "...",
  "summary_ja": "200字程度の日本語要約",
  "key_insights": ["インサイト1", "インサイト2", "インサイト3"],
  "relevance_score": 0-100
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
    max_tokens: 1024,
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
