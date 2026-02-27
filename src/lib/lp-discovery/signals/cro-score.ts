/**
 * CROベストプラクティス適合度スコア
 *
 * ConvertCart, Unbounce, NNG等の実証研究に基づく15項目のチェックリスト。
 * 「美しさ」ではなく「コンバージョンに効く構造を持っているか」を採点する。
 * 合計 weight = 100
 */
import { load } from 'cheerio'

export interface CROSignal {
  name: string
  category: 'design' | 'ux' | 'messaging' | 'trust'
  passed: boolean
  weight: number
  detail: string
}

export interface CROResult {
  score: number
  signals: CROSignal[]
  passedCount: number
  totalChecks: number
}

const CTA_KEYWORDS_JA = [
  '申し込み', '資料請求', '無料', '登録', 'お問い合わせ',
  'ダウンロード', '購入', '体験', '始める', '試す', '予約', '相談', '見積',
]
const CTA_KEYWORDS_EN = [
  'sign up', 'get started', 'free trial', 'contact', 'buy', 'download',
  'register', 'try', 'start',
]

const BENEFIT_KEYWORDS_JA = ['できる', 'になる', '解決', '実現', '向上', '削減', '改善']
const BENEFIT_KEYWORDS_EN = ['results', 'achieve', 'save', 'increase', 'reduce', 'improve']

const SOCIAL_PROOF_KEYWORDS = [
  '導入実績', 'お客様の声', '事例', '選ばれる理由', '満足度',
  'レビュー', '実績', '口コミ', 'testimonial', 'review', 'case study',
]

const TRUST_KEYWORDS = [
  'SSL', 'セキュリティ', 'プライバシー', 'ISO', '認証', 'security', 'privacy',
]

export async function assessCROCompliance(url: string, preloadedHtml?: string): Promise<CROResult> {
  let html = preloadedHtml ?? ''

  if (!html) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) html = await res.text()
    } catch {
      // HTML取得失敗時は全項目false
    }
  }

  if (!html) {
    return { score: 0, signals: [], passedCount: 0, totalChecks: 15 }
  }

  const $ = load(html)
  $('script, style, noscript').remove()

  const bodyText = $('body').text().toLowerCase()
  const htmlLower = html.toLowerCase()
  const htmlLen = html.length

  const signals: CROSignal[] = []

  // --- Design カテゴリ ---

  // 1. CTA存在確認 (weight: 12)
  const ctaElements = $('a, button').toArray()
  const hasCta = ctaElements.some((el) => {
    const text = $(el).text().toLowerCase()
    return (
      CTA_KEYWORDS_JA.some((k) => text.includes(k)) ||
      CTA_KEYWORDS_EN.some((k) => text.includes(k))
    )
  })
  signals.push({
    name: 'CTA存在確認',
    category: 'design',
    passed: hasCta,
    weight: 12,
    detail: hasCta ? 'CTAボタン/リンクを検出' : 'CTAが見当たらない',
  })

  // 2. CTA配置（ページ上部） (weight: 8)
  const ctaInFirst30 =
    CTA_KEYWORDS_JA.some((k) => htmlLower.slice(0, htmlLen * 0.3).includes(k)) ||
    CTA_KEYWORDS_EN.some((k) => htmlLower.slice(0, htmlLen * 0.3).includes(k))
  signals.push({
    name: 'CTA配置（ページ上部）',
    category: 'design',
    passed: ctaInFirst30,
    weight: 8,
    detail: ctaInFirst30 ? 'ページ上部にCTAを確認' : 'ページ上部にCTAが見当たらない',
  })

  // 3. 単一目的の集中 (weight: 8)
  const externalLinks = $('a[href]').toArray().filter((el) => {
    const href = $(el).attr('href') ?? ''
    return href.startsWith('http')
  }).length
  const navLinks = $('nav a, header a').length
  const focused = externalLinks <= 5 && navLinks <= 5
  signals.push({
    name: '単一目的の集中',
    category: 'design',
    passed: focused,
    weight: 8,
    detail: `外部リンク: ${externalLinks}件 / ナビリンク: ${navLinks}件`,
  })

  // 4. ヒーロー領域の画像/動画 (weight: 5)
  const heroHtml = htmlLower.slice(0, htmlLen * 0.3)
  const hasHeroMedia = /<img\s/i.test(heroHtml) || /<video\s/i.test(heroHtml) || /background-image/i.test(heroHtml)
  signals.push({
    name: 'ヒーロー領域の画像/動画',
    category: 'design',
    passed: hasHeroMedia,
    weight: 5,
    detail: hasHeroMedia ? 'ヒーロー画像/動画あり' : 'ヒーローメディアなし',
  })

  // 5. クリーンなレイアウト (weight: 5)
  const hasSidebar = $('aside, .sidebar, #sidebar').length > 0
  const iframeCount = $('iframe').length
  const isClean = !hasSidebar && iframeCount <= 2
  signals.push({
    name: 'クリーンなレイアウト',
    category: 'design',
    passed: isClean,
    weight: 5,
    detail: `サイドバー: ${hasSidebar ? 'あり' : 'なし'} / iframe: ${iframeCount}個`,
  })

  // --- UX カテゴリ ---

  // 6. フォーム存在 (weight: 10)
  const hasForm =
    $('form').length > 0 ||
    $('input[type="email"], input[type="tel"]').length > 0
  signals.push({
    name: 'フォーム存在',
    category: 'ux',
    passed: hasForm,
    weight: 10,
    detail: hasForm ? 'リード獲得フォームあり' : 'フォームなし',
  })

  // 7. フォームフィールド数の適切さ (weight: 5)
  const inputCount = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"])').length
  const formFieldOk = inputCount === 0 || (inputCount >= 1 && inputCount <= 7)
  signals.push({
    name: 'フォームフィールド数',
    category: 'ux',
    passed: formFieldOk,
    weight: 5,
    detail: `入力フィールド数: ${inputCount}`,
  })

  // 8. ページ構造の明確さ (weight: 8)
  const h1Count = $('h1').length
  const sectionCount = $('section, h2, h3').length
  const hasGoodStructure = h1Count === 1 && sectionCount >= 3
  signals.push({
    name: 'ページ構造の明確さ',
    category: 'ux',
    passed: hasGoodStructure,
    weight: 8,
    detail: `H1: ${h1Count}個 / セクション等: ${sectionCount}個`,
  })

  // 9. モバイル対応 (weight: 5)
  const hasViewport = $('meta[name="viewport"]').length > 0
  signals.push({
    name: 'モバイル対応',
    category: 'ux',
    passed: hasViewport,
    weight: 5,
    detail: hasViewport ? 'viewportメタタグあり' : 'viewportメタタグなし',
  })

  // 10. ページ軽量性 (weight: 3)
  const isLightweight = html.length <= 500 * 1024 // 500KB
  signals.push({
    name: 'ページ軽量性',
    category: 'ux',
    passed: isLightweight,
    weight: 3,
    detail: `HTML: ${Math.round(html.length / 1024)}KB`,
  })

  // --- Messaging カテゴリ ---

  // 11. 見出しの明確さ (weight: 8)
  const h1Text = $('h1').first().text().trim()
  const h1Len = h1Text.length
  const h1IsGood = h1Len >= 10 && h1Len <= 80
  signals.push({
    name: '見出しの明確さ',
    category: 'messaging',
    passed: h1IsGood,
    weight: 8,
    detail: h1Text ? `H1: "${h1Text.slice(0, 40)}..." (${h1Len}字)` : 'H1なし',
  })

  // 12. ベネフィット訴求 (weight: 7)
  const benefitCount =
    BENEFIT_KEYWORDS_JA.filter((k) => bodyText.includes(k)).length +
    BENEFIT_KEYWORDS_EN.filter((k) => bodyText.includes(k)).length
  signals.push({
    name: 'ベネフィット訴求',
    category: 'messaging',
    passed: benefitCount >= 3,
    weight: 7,
    detail: `ベネフィットキーワード: ${benefitCount}個`,
  })

  // 13. 価値提案の存在 (weight: 5)
  const metaDesc = $('meta[name="description"]').attr('content') ?? ''
  const hasValueProp = metaDesc.length >= 50
  signals.push({
    name: '価値提案の存在',
    category: 'messaging',
    passed: hasValueProp,
    weight: 5,
    detail: `meta description: ${metaDesc.length}字`,
  })

  // --- Trust カテゴリ ---

  // 14. ソーシャルプルーフ (weight: 8)
  const hasSocialProof = SOCIAL_PROOF_KEYWORDS.some((k) => bodyText.includes(k.toLowerCase()))
  signals.push({
    name: 'ソーシャルプルーフ',
    category: 'trust',
    passed: hasSocialProof,
    weight: 8,
    detail: hasSocialProof ? '実績・口コミ・事例を確認' : 'ソーシャルプルーフなし',
  })

  // 15. 信頼バッジ/認証 (weight: 3)
  const hasTrustBadge = TRUST_KEYWORDS.some((k) => bodyText.includes(k.toLowerCase()))
  signals.push({
    name: '信頼バッジ/認証',
    category: 'trust',
    passed: hasTrustBadge,
    weight: 3,
    detail: hasTrustBadge ? '信頼シグナルを確認' : '信頼バッジなし',
  })

  // スコア算出（重み付き）
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0)
  const passedWeight = signals.filter((s) => s.passed).reduce((sum, s) => sum + s.weight, 0)
  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0

  return {
    score,
    signals,
    passedCount: signals.filter((s) => s.passed).length,
    totalChecks: signals.length,
  }
}
