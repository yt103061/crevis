import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { analyzeLPPage } from '@/lib/lp-analyzer'
import { analyzeLP } from '@/lib/ai-client'
import { estimateDaysActive } from '@/lib/longevity'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { status, rejection_reason } = body
  const supabase = createServiceClient({ requireServiceRole: true })

  const { data: candidate } = await supabase.from('lp_candidates').select('*').eq('id', params.id).single()
  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (status === 'rejected') {
    await supabase.from('lp_candidates').update({ status: 'rejected', rejection_reason, reviewed_at: new Date().toISOString() }).eq('id', params.id)
    return NextResponse.json({ success: true })
  }

  if (status === 'accepted') {
    await supabase.from('lp_candidates').update({ status: 'accepted', reviewed_at: new Date().toISOString() }).eq('id', params.id)

    const { data: lp } = await supabase.from('lps').insert({
      url: candidate.url,
      title: candidate.page_title,
      status: 'active',
      candidate_id: candidate.id,
      lp_confidence_score: candidate.lp_confidence_score,
      is_likely_lp: candidate.is_likely_lp,
    }).select().single()

    if (!lp) return NextResponse.json({ error: 'LP insert failed' }, { status: 500 })

    let features
    try { features = await analyzeLPPage(candidate.url) } catch (e) { console.error(e) }
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

    try {
      const analysisResult = await analyzeLP({
        url: candidate.url,
        industry: '不明',
        purpose: '不明',
        target_audience: '不明',
        days_active: await estimateDaysActive(candidate.url),
      }, features)
      await supabase.from('lp_analyses').insert({ lp_id: lp.id, ...analysisResult })
    } catch (e) {
      console.error('analyze failed', e)
    }

    return NextResponse.json({ success: true, lpId: lp.id })
  }

  return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
}
