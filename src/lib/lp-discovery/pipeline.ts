/**
 * LP発見パイプライン
 *
 * 処理フロー:
 *   1. 各ソースから候補URL収集
 *   2. URL正規化 + 既存URL重複排除
 *   3. url-filter で事前除外
 *   4. CRO適合度スコアリング → 50点未満は除外
 *   5. AI LP判定 → confidence 0.7未満 or is_lp:false は除外
 *   6. Longevity チェック（Wayback Machine API）
 *   7. AI 4軸分析 + メタデータ（industry, lp_purpose, design_taste）
 *   8. Effectiveness Score 算出
 *   9. grade D（40点未満）は登録しない
 *  10. lps テーブルに INSERT（screenshot_url = NULL）
 */
import { createServiceClient } from '@/lib/supabase'
import { analyzeLP } from '@/lib/ai-client'
import { isLikelyLP } from './filters/url-filter'
import { assessCROCompliance } from './signals/cro-score'
import { checkLongevity } from './signals/longevity'
import { judgeIsLP } from './filters/ai-lp-judge'
import { calculateEffectivenessScore } from './effectiveness-score'
import { normalizeUrl, hashUrl, isDuplicate } from './dedup'
import { discoverFromPRTimes } from './sources/prtimes'
import { load } from 'cheerio'

const DAILY_LIMIT = parseInt(process.env.LP_DAILY_PROCESS_LIMIT ?? '20', 10)

export interface PipelineResult {
  discovered: number
  urlFiltered: number
  croFiltered: number
  aiApproved: number
  promoted: number
}

export async function runDiscoveryPipeline(): Promise<PipelineResult> {
  const supabase = createServiceClient()

  const result: PipelineResult = {
    discovered: 0,
    urlFiltered: 0,
    croFiltered: 0,
    aiApproved: 0,
    promoted: 0,
  }

  // 1. 各ソースから候補URL収集
  const candidates = await discoverFromPRTimes().catch((e) => {
    console.error('[Pipeline] PR TIMES 取得エラー:', e)
    return []
  })

  result.discovered = candidates.length
  let processed = 0

  for (const candidate of candidates) {
    if (processed >= DAILY_LIMIT) break

    try {
      // 2. URL正規化
      const normalized = normalizeUrl(candidate.url)
      const urlHash = hashUrl(normalized)

      // 重複チェック
      const duplicate = await isDuplicate(normalized, supabase)
      if (duplicate) continue

      // 3. URLフィルター
      const urlCheck = isLikelyLP(normalized)
      if (!urlCheck.pass) {
        result.urlFiltered++
        await supabase.from('lp_candidates').upsert(
          {
            url: normalized,
            url_hash: urlHash,
            source: candidate.source,
            source_type: 'pipeline',
            status: 'rejected',
            processed_at: new Date().toISOString(),
          },
          { onConflict: 'url' }
        )
        continue
      }

      // HTMLを一度だけ取得（CRO + AI judge で再利用）
      let html = ''
      try {
        const res = await fetch(normalized, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreVisBot/1.0)' },
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) html = await res.text()
      } catch {
        // HTML取得失敗してもCROは0点で継続
      }

      // 4. CROスコアリング
      const cro = await assessCROCompliance(normalized, html)
      if (cro.score < 50) {
        result.croFiltered++
        await supabase.from('lp_candidates').upsert(
          {
            url: normalized,
            url_hash: urlHash,
            source: candidate.source,
            source_type: 'pipeline',
            heuristic_score: cro.score,
            status: 'rejected',
            processed_at: new Date().toISOString(),
          },
          { onConflict: 'url' }
        )
        continue
      }

      // 5. AI LP判定（cheerio でサマリーを抽出してから判定）
      const $doc = load(html)
      $doc('script, style, noscript').remove()
      const htmlSummary = {
        title: $doc('title').first().text().trim() || candidate.title || '',
        description: $doc('meta[name="description"]').attr('content') ?? '',
        headings: $doc('h1, h2')
          .map((_, el) => $doc(el).text().trim())
          .toArray()
          .filter(Boolean)
          .slice(0, 5),
        ctas: $doc('button, a[href]')
          .map((_, el) => $doc(el).text().trim())
          .toArray()
          .filter(Boolean)
          .slice(0, 8),
      }

      const lpJudge = await judgeIsLP(normalized, htmlSummary)
      if (!lpJudge.isLP || lpJudge.confidence < 0.7) {
        result.urlFiltered++
        await supabase.from('lp_candidates').upsert(
          {
            url: normalized,
            url_hash: urlHash,
            source: candidate.source,
            source_type: 'pipeline',
            heuristic_score: cro.score,
            ai_is_lp: lpJudge.isLP,
            ai_confidence: lpJudge.confidence,
            status: 'rejected',
            processed_at: new Date().toISOString(),
          },
          { onConflict: 'url' }
        )
        continue
      }

      result.aiApproved++

      // 候補を new として保存（UIフィルターと一致させる）
      const { error: upsertErr } = await supabase.from('lp_candidates').upsert(
        {
          url: normalized,
          url_hash: urlHash,
          source: candidate.source,
          source_type: 'pipeline',
          heuristic_score: cro.score,
          ai_is_lp: lpJudge.isLP,
          ai_confidence: lpJudge.confidence,
          status: 'new',
          processed_at: new Date().toISOString(),
        },
        { onConflict: 'url' }
      )
      if (upsertErr) {
        console.error('[Pipeline] lp_candidates upsert失敗:', normalized, upsertErr.message)
      }

      // 6. Longevity チェック（APIレート制限対策: 1秒待機）
      await new Promise((r) => setTimeout(r, 1000))
      const longevity = await checkLongevity(normalized)

      // 7. AI 4軸分析
      const aiAnalysis = await analyzeLP({
        url: normalized,
        industry: '',
        purpose: '',
        target_audience: '',
        days_active: longevity.ageInDays,
        rawHtml: html,
      })

      // 8. Effectiveness Score 算出
      const effectiveness = calculateEffectivenessScore(longevity, cro, {
        structure: aiAnalysis.structure_score,
        copy: aiAnalysis.copy_score,
        trust: aiAnalysis.trust_score,
        operation: aiAnalysis.longevity_score,
      })

      // 9. grade D は登録しない
      if (effectiveness.grade === 'D') continue

      // 10. lps テーブルに INSERT
      const { data: lpData, error: lpError } = await supabase
        .from('lps')
        .upsert(
          {
            url: normalized,
            url_hash: urlHash,
            title: htmlSummary.title || null,
            industry: aiAnalysis.inferred_industry || null,
            lp_purpose: aiAnalysis.inferred_lp_purpose || null,
            design_taste: aiAnalysis.inferred_design_taste || null,
            purpose: aiAnalysis.inferred_purpose || null,
            target_audience: aiAnalysis.inferred_target_audience || null,
            source: candidate.source,
            status: 'archived',
            cro_score: cro.score,
            longevity_score: longevity.longevityScore,
            effectiveness_score: effectiveness.effectivenessScore,
            effectiveness_grade: effectiveness.grade,
            longevity_checked_at: new Date().toISOString(),
            cro_checked_at: new Date().toISOString(),
          },
          { onConflict: 'url' }
        )
        .select('id')
        .single()

      if (lpError || !lpData) {
        console.error('[Pipeline] lps upsert失敗:', normalized, lpError?.message)
        continue
      }

      const lpId = (lpData as { id: string }).id

      // AI分析を保存
      await supabase.from('lp_analyses').insert({
        lp_id: lpId,
        structure_score: aiAnalysis.structure_score,
        copy_score: aiAnalysis.copy_score,
        trust_score: aiAnalysis.trust_score,
        longevity_score: aiAnalysis.longevity_score,
        total_score: aiAnalysis.total_score,
        good_points: aiAnalysis.good_points,
        improvement_points: aiAnalysis.improvement_points,
        why_it_works: aiAnalysis.why_it_works,
        target_match: aiAnalysis.target_match,
        embedding: aiAnalysis.embedding ?? null,
      })

      // grade S/A は公開状態に昇格
      if (effectiveness.grade === 'S' || effectiveness.grade === 'A') {
        await supabase.from('lps').update({ status: 'active' }).eq('id', lpId)
      }

      // lp_candidates を accepted に更新
      await supabase
        .from('lp_candidates')
        .update({ status: 'auto_accepted' })
        .eq('url', normalized)

      result.promoted++
      processed++
    } catch (e) {
      console.error('[Pipeline] 候補処理エラー:', candidate.url, e)
    }
  }

  return result
}
