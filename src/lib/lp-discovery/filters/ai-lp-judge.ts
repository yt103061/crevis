/**
 * AI LP判定フィルター
 *
 * CROスコアを通過した候補に対し、「LPかどうか」をAIに最終判定させる。
 * confidence 0.7以上 かつ is_lp: true のみ合格。
 */
import { callAI } from '@/lib/ai-client'

interface HtmlSummary {
  title: string
  description: string
  headings: string[]
  ctas: string[]
}

interface LPJudgeResult {
  isLP: boolean
  confidence: number
  reason: string
}

function extractJSON(raw: string): unknown {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1].trim())
  }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    return JSON.parse(raw.slice(start, end + 1))
  }
  return JSON.parse(raw)
}

export async function judgeIsLP(
  url: string,
  htmlSummary: HtmlSummary
): Promise<LPJudgeResult> {
  const prompt = `以下のWebページがランディングページかどうか判定してください。

ランディングページの定義: 広告やメール等からの流入先として設計された、特定の1つの目的（購入、資料請求、会員登録、問い合わせ等）に訪問者を誘導する単一ページ。

以下はLPではない:
- 企業のトップページ（複数サービスを紹介）
- ブログ記事・ニュース記事
- EC商品一覧ページ
- 会社概要・採用ページ
- ゲームの公式サイトのお知らせページ

URL: ${url}
タイトル: ${htmlSummary.title || '(なし)'}
説明文: ${htmlSummary.description || '(なし)'}
見出し: ${htmlSummary.headings.slice(0, 5).join(' / ') || '(なし)'}
CTAテキスト: ${htmlSummary.ctas.slice(0, 5).join(' / ') || '(なし)'}

JSON形式で回答（他のテキスト不要）:
{"is_lp": true/false, "confidence": 0.0-1.0, "reason": "理由を1文で"}`

  try {
    const raw = await callAI(prompt)
    const result = extractJSON(raw) as { is_lp: boolean; confidence: number; reason: string }
    return {
      isLP: result.is_lp ?? false,
      confidence: result.confidence ?? 0,
      reason: result.reason ?? '',
    }
  } catch {
    return { isLP: false, confidence: 0, reason: 'AI判定エラー' }
  }
}
