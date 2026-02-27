import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { analyzeLP } from '@/lib/ai-client'
import { requireAdminAuth } from '@/lib/auth'
import { analyzeLpHtml } from '@/lib/lp-analyzer'
import { estimateDaysActive } from '@/lib/longevity'

export async function POST(request: NextRequest) {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { url, industry, purpose, target_audience, ad_platform, force } = body

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const supabase = createServiceClient({ requireServiceRole: true })

    // Step 1: HTMLを取得してLP判定
    let rawHtml = ''
    let pageFeatures = null
    try {
      const fetchRes = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0; +https://crevis.jp)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(12000),
      })
      if (fetchRes.ok) {
        rawHtml = await fetchRes.text()
        pageFeatures = analyzeLpHtml(rawHtml, url)
      }
    } catch (fetchErr) {
      console.warn('HTML fetch failed:', fetchErr)
    }

    // LP判定: 信頼スコアが低い場合は force フラグがなければ拒否
    if (pageFeatures && !pageFeatures.isLikelyLP && !force) {
      return NextResponse.json(
        {
          error: 'NOT_LP',
          message: 'このページはランディングページではない可能性があります',
          lpConfidenceScore: pageFeatures.lpConfidenceScore,
          pageFeatures,
        },
        { status: 422 }
      )
    }

    // Step 2: Wayback Machineで掲載日数を推定
    let daysActive = 30
    try {
      const estimated = await estimateDaysActive(url)
      if (estimated > 0) daysActive = estimated
    } catch {
      // フォールバック
    }

    // Step 3: LP登録
    const inferredTitle = pageFeatures?.metaTitle || null
    const { data: lp, error: lpError } = await supabase
      .from('lps')
      .insert({
        url,
        title: inferredTitle,
        industry,
        purpose,
        target_audience,
        ad_platform,
        status: 'active',
        lp_confidence_score: pageFeatures?.lpConfidenceScore ?? null,
        is_likely_lp: pageFeatures?.isLikelyLP ?? null,
      })
      .select()
      .single()

    if (lpError) {
      if (lpError.code === '23505') {
        return NextResponse.json({ error: 'この URL は既に登録されています' }, { status: 409 })
      }
      throw lpError
    }

    // Step 4: LP構造情報をDB保存
    if (pageFeatures) {
      try {
        await supabase.from('lp_page_features').insert({
          lp_id: lp.id,
          is_likely_lp: pageFeatures.isLikelyLP,
          lp_confidence_score: pageFeatures.lpConfidenceScore,
          total_sections: pageFeatures.totalSections,
          page_height_ratio: pageFeatures.pageHeightRatio,
          nav_link_count: pageFeatures.navLinkCount,
          external_link_count: pageFeatures.externalLinkCount,
          internal_link_count: pageFeatures.internalLinkCount,
          cta_buttons: pageFeatures.ctaButtons,
          form_field_count: pageFeatures.formFieldCount,
          has_main_form: pageFeatures.hasMainForm,
          h1_text: pageFeatures.h1Text,
          h2_texts: pageFeatures.h2Texts,
          meta_description: pageFeatures.metaDescription,
          meta_title: pageFeatures.metaTitle,
          main_copy_snippets: pageFeatures.mainCopySnippets,
          has_social_proof: pageFeatures.hasSocialProof,
          has_testimonials: pageFeatures.hasTestimonials,
          has_faq: pageFeatures.hasFAQ,
          has_pricing: pageFeatures.hasPricing,
          has_no_index: pageFeatures.hasNoIndex,
          og_type: pageFeatures.ogType,
          canonical_url: pageFeatures.canonicalUrl,
          total_image_count: pageFeatures.totalImageCount,
          has_video: pageFeatures.hasVideo,
        })
      } catch (featErr) {
        console.warn('Failed to save lp_page_features:', featErr)
      }
    }

    // Step 5: AI分析
    let analysisResult
    try {
      analysisResult = await analyzeLP({
        url,
        industry: industry ?? '不明',
        purpose: purpose ?? '不明',
        target_audience: target_audience ?? '不明',
        days_active: daysActive,
        rawHtml: rawHtml || undefined,
        pageFeatures: pageFeatures ?? undefined,
      })
    } catch (aiError) {
      console.error('AI analysis failed:', aiError)
      return NextResponse.json({ lp, analysis: null, warning: 'AI分析に失敗しました' })
    }

    // Step 6: 分析結果をDB保存
    const { data: analysis, error: analysisError } = await supabase
      .from('lp_analyses')
      .insert({
        lp_id: lp.id,
        ...analysisResult,
      })
      .select()
      .single()

    if (analysisError) {
      console.error('Failed to save analysis:', analysisError)
    }

    // Step 7: GitHub Actionsでスクリーンショット取得をトリガー
    const githubToken = process.env.GITHUB_TOKEN
    const githubRepo = process.env.GITHUB_REPO
    if (githubToken && githubRepo) {
      try {
        await fetch(
          `https://api.github.com/repos/${githubRepo}/actions/workflows/screenshot.yml/dispatches`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${githubToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ref: 'main',
              inputs: { lp_id: lp.id, url },
            }),
          }
        )
      } catch (ghError) {
        console.error('Failed to trigger screenshot workflow:', ghError)
      }
    }

    return NextResponse.json({ lp, analysis, daysActive, lpConfidenceScore: pageFeatures?.lpConfidenceScore })
  } catch (error) {
    console.error('LP creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
