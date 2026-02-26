import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { analyzeLP } from '@/lib/ai-client'
import { requireAdminAuth } from '@/lib/auth'
import { analyzeLPPage } from '@/lib/lp-analyzer'
import { estimateDaysActive } from '@/lib/longevity'

export async function POST(request: NextRequest) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { url, industry, purpose, target_audience, ad_platform, force } = body

    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    let features
    try {
      features = await analyzeLPPage(url)
      if (!features.isLikelyLP && !force) {
        return NextResponse.json({
          error: 'このURLはLPではない可能性があります',
          lpConfidenceScore: features.lpConfidenceScore,
          requiresForce: true,
        }, { status: 422 })
      }
    } catch (error) {
      console.error('LP page analysis failed:', error)
    }

    const daysActive = await estimateDaysActive(url)
    const supabase = createServiceClient({ requireServiceRole: true })

    const { data: lp, error: lpError } = await supabase
      .from('lps')
      .insert({
        url,
        industry,
        purpose,
        target_audience,
        ad_platform,
        status: 'active',
        lp_confidence_score: features?.lpConfidenceScore ?? null,
        is_likely_lp: features?.isLikelyLP ?? true,
      })
      .select()
      .single()

    if (lpError) {
      if (lpError.code === '23505') return NextResponse.json({ error: 'この URL は既に登録されています' }, { status: 409 })
      throw lpError
    }

    if (features) {
      await supabase.from('lp_page_features').upsert({
        lp_id: lp.id,
        h1_text: features.h1Text,
        h2_texts: features.h2Texts,
        meta_title: features.metaTitle,
        meta_description: features.metaDescription,
        main_copy_snippets: features.mainCopySnippets,
        cta_buttons: features.ctaButtons,
        total_sections: features.totalSections,
        page_height_ratio: features.pageHeightRatio,
        nav_link_count: features.navLinkCount,
        external_link_count: features.externalLinkCount,
        internal_link_count: features.internalLinkCount,
        form_field_count: features.formFieldCount,
        has_main_form: features.hasMainForm,
        has_social_proof: features.hasSocialProof,
        has_testimonials: features.hasTestimonials,
        has_faq: features.hasFAQ,
        has_pricing: features.hasPricing,
        has_no_index: features.hasNoIndex,
        has_video: features.hasVideo,
        total_image_count: features.totalImageCount,
      })
    }

    let analysisResult
    try {
      analysisResult = await analyzeLP({
        url,
        industry: industry ?? '不明',
        purpose: purpose ?? '不明',
        target_audience: target_audience ?? '不明',
        days_active: daysActive,
      }, features)
    } catch (aiError) {
      console.error('AI analysis failed:', aiError)
      return NextResponse.json({ lp, analysis: null, warning: 'AI分析に失敗しました' })
    }

    const { data: analysis } = await supabase
      .from('lp_analyses')
      .insert({ lp_id: lp.id, ...analysisResult })
      .select()
      .single()

    const githubToken = process.env.GITHUB_TOKEN
    const githubRepo = process.env.GITHUB_REPO
    if (githubToken && githubRepo) {
      try {
        await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/screenshot.yml/dispatches`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main', inputs: { lp_id: lp.id, url } }),
        })
      } catch (ghError) {
        console.error('Failed to trigger screenshot workflow:', ghError)
      }
    }

    return NextResponse.json({ lp, analysis, lpConfidenceScore: features?.lpConfidenceScore ?? null })
  } catch (error) {
    console.error('LP creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
