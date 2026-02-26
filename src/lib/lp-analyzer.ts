/**
 * LP構造分析モジュール
 * cheerioを使ってHTMLからLPの特徴を抽出し、LPらしさを判定する
 */

import * as cheerio from 'cheerio'
import type { LPPageFeatures } from '@/types'

/** LP的なCTAワードリスト */
const CTA_WORDS = [
  '無料', '申し込む', '申込', '登録', '始める', 'はじめる', '試す', '体験', '問い合わせ', '資料請求',
  '詳しく', '今すぐ', 'ダウンロード', '見る', '確認', '購入', '買う', '予約', '相談',
  'Start', 'Get Started', 'Sign Up', 'Sign up', 'Try', 'Free', 'Download', 'Contact',
  'Learn More', 'Get', 'Book', 'Request', 'Register', 'Buy', 'Order',
]

/** ニュース・ブログ記事に特有のパターン */
const ARTICLE_PATTERNS = [
  /by\s+[A-Z][a-z]+\s+[A-Z]/,
  /\d{4}年\d{1,2}月\d{1,2}日/,
  /published/i,
  /updated/i,
]

/**
 * HTMLからLPページの特徴を抽出する
 */
export function analyzeLpHtml(html: string, url: string): LPPageFeatures {
  const $ = cheerio.load(html)

  // メタ情報
  const metaTitle = $('title').first().text().trim()
  const metaDescription = $('meta[name="description"]').attr('content') ?? ''
  const ogType = $('meta[property="og:type"]').attr('content') ?? ''
  const canonicalUrl = $('link[rel="canonical"]').attr('href') ?? url
  const hasNoIndex = $('meta[name="robots"]').attr('content')?.includes('noindex') ?? false

  // ナビゲーション
  const navLinks = $('nav a, header a').length
  const allLinks = $('a[href]')
  let externalLinkCount = 0
  let internalLinkCount = 0
  try {
    const baseHost = new URL(url).hostname
    allLinks.each((_, el) => {
      const href = $(el).attr('href') ?? ''
      if (!href || href.startsWith('#') || href.startsWith('javascript')) return
      if (href.startsWith('http') && !href.includes(baseHost)) {
        externalLinkCount++
      } else {
        internalLinkCount++
      }
    })
  } catch {
    // URL parse error
  }

  // CTAボタン
  const ctaButtons: string[] = []
  $('button, a.btn, a.button, [class*="cta"], [class*="btn"], input[type="submit"]').each((_, el) => {
    const text = $(el).text().trim()
    if (text && CTA_WORDS.some((w) => text.includes(w))) {
      ctaButtons.push(text.slice(0, 50))
    }
  })

  // フォーム
  const forms = $('form')
  const hasMainForm = forms.length > 0
  let formFieldCount = 0
  forms.each((_, form) => {
    formFieldCount += $(form).find('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea').length
  })

  // 見出し
  const h1Text = $('h1').first().text().trim()
  const h2Texts: string[] = []
  $('h2').each((_, el) => {
    const t = $(el).text().trim()
    if (t) h2Texts.push(t.slice(0, 100))
  })

  // メインコピースニペット（h1, h2, 大きめの p タグ先頭部分）
  const mainCopySnippets: string[] = []
  if (h1Text) mainCopySnippets.push(h1Text)
  h2Texts.slice(0, 3).forEach((t) => mainCopySnippets.push(t))
  $('p').each((_, el) => {
    if (mainCopySnippets.length >= 8) return
    const t = $(el).text().trim()
    if (t.length > 30 && t.length < 300) mainCopySnippets.push(t)
  })

  // ソーシャルプルーフ・信頼シグナル
  const bodyText = $('body').text()
  const hasSocialProof =
    /導入企業|導入実績|利用者数|会員数|\d+社|\d+人|\d+件|customers|companies|users/i.test(bodyText)
  const hasTestimonials =
    /お客様の声|導入事例|testimonial|review|評価|★|⭐/i.test(bodyText) ||
    $('[class*="testimonial"], [class*="review"], [class*="voice"]').length > 0
  const hasFAQ =
    /よくある質問|FAQ|Q&A|frequently asked/i.test(bodyText) ||
    $('[class*="faq"], [class*="accordion"]').length > 0
  const hasPricing =
    /料金|価格|プラン|pricing|plan|\$/i.test(bodyText) ||
    $('[class*="price"], [class*="plan"], [class*="pricing"]').length > 0

  // セクション数（LP的なセクション区切り）
  const totalSections = $('section, [class*="section"], [class*="block"], article > div').length

  // 画像・動画
  const totalImageCount = $('img').length
  const hasVideo = $('video, iframe[src*="youtube"], iframe[src*="vimeo"], [class*="video"]').length > 0

  // ページ高さ推定（テキスト量から近似）
  const textLength = bodyText.replace(/\s+/g, ' ').trim().length
  const pageHeightRatio = Math.min(textLength / 3000, 5) // 正規化

  // article的パターン検出（ニュース/ブログ記事判定）
  const articlePatternCount = ARTICLE_PATTERNS.filter((p) => p.test(html)).length
  const isArticleLike = articlePatternCount >= 2 || ogType === 'article'

  // LP信頼スコア計算
  let score = 50
  if (hasMainForm && formFieldCount >= 1) score += 15
  if (ctaButtons.length >= 2) score += 15
  else if (ctaButtons.length >= 1) score += 8
  if (hasSocialProof) score += 5
  if (hasTestimonials) score += 5
  if (hasFAQ) score += 5
  if (hasPricing) score += 5
  if (navLinks <= 3) score += 10
  else if (navLinks > 10) score -= 15
  if (isArticleLike) score -= 30
  if (hasNoIndex) score -= 10
  if (ogType === 'article') score -= 20
  if (h1Text.length === 0) score -= 10
  if (externalLinkCount > 20) score -= 10

  const lpConfidenceScore = Math.max(0, Math.min(100, score))
  const isLikelyLP = lpConfidenceScore >= 45

  return {
    isLikelyLP,
    lpConfidenceScore,
    totalSections,
    pageHeightRatio,
    navLinkCount: navLinks,
    externalLinkCount,
    internalLinkCount,
    ctaButtons: ctaButtons.slice(0, 10),
    formFieldCount,
    hasMainForm,
    h1Text: h1Text.slice(0, 200),
    h2Texts: h2Texts.slice(0, 10),
    metaDescription: metaDescription.slice(0, 300),
    metaTitle: metaTitle.slice(0, 200),
    mainCopySnippets: mainCopySnippets.slice(0, 8),
    hasSocialProof,
    hasTestimonials,
    hasFAQ,
    hasPricing,
    hasNoIndex,
    ogType,
    canonicalUrl,
    pageLoadTimeMs: 0, // スクリーンショット側で計測
    totalImageCount,
    hasVideo,
  }
}
