import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { analyzeLP } from '@/lib/ai-client'
import { requireAdminAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { url, industry, purpose, target_audience, ad_platform } = body

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const supabase = createServiceClient({ requireServiceRole: true })

    // LP登録
    const { data: lp, error: lpError } = await supabase
      .from('lps')
      .insert({
        url,
        industry,
        purpose,
        target_audience,
        ad_platform,
        status: 'active',
      })
      .select()
      .single()

    if (lpError) {
      if (lpError.code === '23505') {
        return NextResponse.json({ error: 'この URL は既に登録されています' }, { status: 409 })
      }
      throw lpError
    }

    // AI分析
    const daysActive = 30 // 初期値
    let analysisResult
    try {
      analysisResult = await analyzeLP({
        url,
        industry: industry ?? '不明',
        purpose: purpose ?? '不明',
        target_audience: target_audience ?? '不明',
        days_active: daysActive,
      })
    } catch (aiError) {
      console.error('AI analysis failed:', aiError)
      // AI分析が失敗してもLP登録は成功させる
      return NextResponse.json({ lp, analysis: null, warning: 'AI分析に失敗しました' })
    }

    // 分析結果をDB保存
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

    // GitHub Actionsでスクリーンショット取得をトリガー
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

    return NextResponse.json({ lp, analysis })
  } catch (error) {
    console.error('LP creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
