import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { analyzeLP } from '@/lib/ai-client'
import { analyzeLpHtml } from '@/lib/lp-analyzer'
import { fetchExternal } from '@/lib/http-client'

async function acceptCandidate(supabase: ReturnType<typeof createServiceClient>, candidateId: string) {
  // 候補情報取得
  const { data: candidate, error: candErr } = await supabase
    .from('lp_candidates')
    .select('*')
    .eq('id', candidateId)
    .single()

  if (candErr || !candidate) throw new Error('Candidate not found')

  // lpsへ登録
  const { data: lp, error: lpErr } = await supabase
    .from('lps')
    .insert({
      url: candidate.url,
      title: candidate.page_title,
      status: 'active',
      lp_confidence_score: candidate.lp_confidence_score,
      is_likely_lp: candidate.is_likely_lp,
      candidate_id: candidateId,
    })
    .select()
    .single()

  if (lpErr) {
    if (lpErr.code === '23505') throw new Error('URL already registered')
    throw lpErr
  }

  // HTML取得してページ特徴保存
  try {
    const res = await fetchExternal(candidate.url, { timeoutMs: 12000 })
    if (res.ok) {
      const html = await res.text()
      const features = analyzeLpHtml(html, candidate.url)
      await supabase.from('lp_page_features').insert({
        lp_id: lp.id,
        is_likely_lp: features.isLikelyLP,
        lp_confidence_score: features.lpConfidenceScore,
        h1_text: features.h1Text,
        h2_texts: features.h2Texts,
        meta_title: features.metaTitle,
        meta_description: features.metaDescription,
        main_copy_snippets: features.mainCopySnippets,
        cta_buttons: features.ctaButtons,
        form_field_count: features.formFieldCount,
        has_main_form: features.hasMainForm,
        total_sections: features.totalSections,
        nav_link_count: features.navLinkCount,
        external_link_count: features.externalLinkCount,
        total_image_count: features.totalImageCount,
        has_video: features.hasVideo,
        has_social_proof: features.hasSocialProof,
        has_testimonials: features.hasTestimonials,
        has_faq: features.hasFAQ,
        has_pricing: features.hasPricing,
        has_no_index: features.hasNoIndex,
        canonical_url: features.canonicalUrl,
        page_height_ratio: features.pageHeightRatio,
      })

      // AI分析
      const analysisResult = await analyzeLP({
        url: candidate.url,
        industry: '不明',
        purpose: '不明',
        target_audience: '不明',
        days_active: 30,
        rawHtml: html,
        pageFeatures: features,
      })

      await supabase.from('lp_analyses').insert({ lp_id: lp.id, ...analysisResult })

      // lp.titleをAIから推論した情報で更新
      if (analysisResult.inferred_industry || analysisResult.inferred_purpose) {
        await supabase.from('lps').update({
          industry: analysisResult.inferred_industry ?? null,
          purpose: analysisResult.inferred_purpose ?? null,
          target_audience: analysisResult.inferred_target_audience ?? null,
        }).eq('id', lp.id)
      }
    }
  } catch (err) {
    console.warn('Analysis failed for candidate:', candidateId, err)
    // 分析失敗してもLP登録は継続
  }

  // GitHub Actionsでスクリーンショット取得
  const githubToken = process.env.GITHUB_TOKEN
  const githubRepo = process.env.GITHUB_REPO
  if (githubToken && githubRepo) {
    try {
      await fetch(
        `https://api.github.com/repos/${githubRepo}/actions/workflows/screenshot.yml/dispatches`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${githubToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: 'main', inputs: { lp_id: lp.id, url: candidate.url } }),
        }
      )
    } catch {
      // スクショ失敗は無視
    }
  }

  // 候補ステータスを更新
  await supabase
    .from('lp_candidates')
    .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
    .eq('id', candidateId)

  return lp
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action, rejection_reason } = body
  const supabase = createServiceClient({ requireServiceRole: true })

  if (action === 'accept') {
    try {
      const lp = await acceptCandidate(supabase, params.id)
      return NextResponse.json({ success: true, lp })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      return NextResponse.json({ error: msg }, { status: msg === 'URL already registered' ? 409 : 500 })
    }
  }

  if (action === 'reject') {
    const { error } = await supabase
      .from('lp_candidates')
      .update({ status: 'rejected', rejection_reason, reviewed_at: new Date().toISOString() })
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// 候補の取得 (GET /api/admin/lp-candidates でリスト取得)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient({ requireServiceRole: true })
  const { error } = await supabase.from('lp_candidates').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
