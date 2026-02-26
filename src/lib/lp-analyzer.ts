import { fetchExternal } from '@/lib/http-client'

export interface LPPageFeatures {
  isLikelyLP: boolean
  lpConfidenceScore: number
  totalSections: number
  pageHeightRatio: number
  navLinkCount: number
  externalLinkCount: number
  internalLinkCount: number
  ctaButtons: string[]
  formFieldCount: number
  hasMainForm: boolean
  h1Text: string
  h2Texts: string[]
  metaDescription: string
  metaTitle: string
  mainCopySnippets: string[]
  hasSocialProof: boolean
  hasTestimonials: boolean
  hasFAQ: boolean
  hasPricing: boolean
  hasNoIndex: boolean
  ogType: string | null
  canonicalUrl: string | null
  totalImageCount: number
  hasVideo: boolean
}

function stripTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickMatches(html: string, regex: RegExp, limit = 20): string[] {
  const local = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`)
  const out: string[] = []
  for (const m of Array.from(html.matchAll(local))) {
    if (m[1]) out.push(stripTags(m[1]).slice(0, 200))
    if (out.length >= limit) break
  }
  return out
}

export async function analyzeLPPage(url: string): Promise<LPPageFeatures> {
  const html = await (await fetchExternal(url)).text()
  const origin = new URL(url).origin

  const h1Text = pickMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i, 1)[0] ?? ''
  const h2Texts = pickMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/i, 20)
  const metaTitle = pickMatches(html, /<title[^>]*>([\s\S]*?)<\/title>/i, 1)[0] ?? ''
  const metaDescription = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]
    ?? '')

  const navBlock = html.match(/<nav[\s\S]*?<\/nav>/i)?.[0] ?? ''
  const navLinkCount = (navBlock.match(/<a\b/gi) ?? []).length

  const hrefs = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)).map((m) => m[1])
  const externalLinkCount = hrefs.filter((href) => href.startsWith('http') && !href.startsWith(origin)).length
  const internalLinkCount = hrefs.length - externalLinkCount

  const buttonTexts = Array.from(html.matchAll(/<(?:button|a)[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)).map((m) => stripTags(m[1]).slice(0, 200))
  const ctaButtons = buttonTexts.filter((text) => /申込|申し込み|無料|登録|相談|購入|資料|download|trial|start|get|contact|book|join|signup|cta/i.test(text)).slice(0, 20)

  const formFieldCount = (html.match(/<(input|select|textarea)\b/gi) ?? []).length
  const hasMainForm = (html.match(/<form\b/gi) ?? []).length > 0 && formFieldCount >= 2

  const totalSections = (html.match(/<(section|article|main|div)\b/gi) ?? []).length
  const pageHeightRatio = Math.max(1, totalSections / 6)

  const mainCopySnippets = Array.from(html.matchAll(/<(?:section|article|main)[^>]*>([\s\S]*?)<\/(?:section|article|main)>/gi))
    .map((m) => stripTags(m[1]).slice(0, 200))
    .slice(0, 10)

  const lower = html.toLowerCase()
  const hasSocialProof = /client|導入実績|利用社数|受賞|featured|trusted by|導入企業/i.test(html)
  const hasTestimonials = /testimonial|review|お客様の声|事例|口コミ/i.test(html)
  const hasFAQ = /faq|よくある質問/i.test(html)
  const hasPricing = /pricing|料金|price|プラン/i.test(html)
  const hasNoIndex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(lower)
  const ogType = html.match(/<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null
  const canonicalUrl = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? null
  const totalImageCount = (html.match(/<img\b/gi) ?? []).length
  const hasVideo = /<video\b|youtube\.com|vimeo\.com|player\./i.test(html)

  let score = 0
  if (navLinkCount <= 5) score += 20
  if (ctaButtons.length >= 1) score += 20
  if (hasMainForm) score += 15
  if (pageHeightRatio >= 3) score += 15
  if (externalLinkCount <= 3) score += 10
  if (hasNoIndex) score += 10
  if (/\/(lp|campaign|promo|landing|register|trial)/i.test(new URL(url).pathname)) score += 5
  if (hasSocialProof || hasTestimonials) score += 5
  if (navLinkCount >= 15) score -= 20
  if (internalLinkCount >= 20) score -= 15
  if (formFieldCount === 0 && ctaButtons.length === 0) score -= 10

  score = Math.max(0, Math.min(100, score))

  return {
    isLikelyLP: score >= 40,
    lpConfidenceScore: score,
    totalSections,
    pageHeightRatio,
    navLinkCount,
    externalLinkCount,
    internalLinkCount,
    ctaButtons,
    formFieldCount,
    hasMainForm,
    h1Text,
    h2Texts,
    metaDescription,
    metaTitle,
    mainCopySnippets,
    hasSocialProof,
    hasTestimonials,
    hasFAQ,
    hasPricing,
    hasNoIndex,
    ogType,
    canonicalUrl,
    totalImageCount,
    hasVideo,
  }
}
