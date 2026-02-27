#!/usr/bin/env node
/**
 * 既存LPのクリーンアップスクリプト
 *
 * 既存 lps テーブルの全LPに対して:
 *   1. url-filter を適用 → 明らかな非LPを status='inactive' に
 *   2. CROスコアを算出して cro_score に保存
 *   3. Longevity を取得して longevity_score に保存（1秒間隔）
 *   4. Effectiveness Score を算出して保存
 *
 * 実行方法:
 *   npx tsx scripts/cleanup-existing-lps.ts --dry-run  # 変更なしで結果表示
 *   npx tsx scripts/cleanup-existing-lps.ts            # 実行
 */
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { isLikelyLP } from '../src/lib/lp-discovery/filters/url-filter'
import { assessCROCompliance } from '../src/lib/lp-discovery/signals/cro-score'
import { checkLongevity } from '../src/lib/lp-discovery/signals/longevity'
import { calculateEffectivenessScore } from '../src/lib/lp-discovery/effectiveness-score'

// .env.local を手動で読み込む
const envPath = path.join(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

const isDryRun = process.argv.includes('--dry-run')

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface LP {
  id: string
  url: string
  status: string
  cro_score: number | null
  longevity_score: number | null
  effectiveness_score: number | null
  lp_analyses?: Array<{
    structure_score: number
    copy_score: number
    trust_score: number
    longevity_score: number
  }>
}

async function main() {
  console.log(`モード: ${isDryRun ? 'DRY RUN（変更なし）' : '本番実行'}`)

  const { data: lps, error } = await supabase
    .from('lps')
    .select('id, url, status, cro_score, longevity_score, effectiveness_score, lp_analyses(structure_score, copy_score, trust_score, longevity_score)')
    .order('created_at', { ascending: true })

  if (error || !lps) {
    console.error('LPの取得に失敗しました:', error?.message)
    process.exit(1)
  }

  console.log(`対象LP数: ${lps.length}件\n`)

  let inactivated = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const lp of lps as LP[]) {
    console.log(`処理中: ${lp.url}`)

    try {
      // 1. URLフィルター
      const urlCheck = isLikelyLP(lp.url)
      if (!urlCheck.pass) {
        console.log(`  ✗ URLフィルター不合格 (${urlCheck.reason}) → inactive`)
        if (!isDryRun && lp.status !== 'inactive') {
          await supabase.from('lps').update({ status: 'inactive' }).eq('id', lp.id)
          inactivated++
        }
        continue
      }

      // 2. CROスコア（未計算の場合のみ）
      let croScore = lp.cro_score
      if (croScore === null) {
        console.log('  → CROスコア算出中...')
        const cro = await assessCROCompliance(lp.url)
        croScore = cro.score
        console.log(`  CROスコア: ${croScore}`)
        if (!isDryRun) {
          await supabase.from('lps').update({ cro_score: croScore, cro_checked_at: new Date().toISOString() }).eq('id', lp.id)
        }
      } else {
        console.log(`  CROスコア（キャッシュ済み）: ${croScore}`)
      }

      // 3. Longevityチェック（未計算の場合のみ）
      let longevityScore = lp.longevity_score
      if (longevityScore === null) {
        console.log('  → Longevity確認中...')
        await new Promise((r) => setTimeout(r, 1000))
        const longevity = await checkLongevity(lp.url)
        longevityScore = longevity.longevityScore
        console.log(`  Longevityスコア: ${longevityScore} (${longevity.ageInDays}日)`)
        if (!isDryRun) {
          await supabase
            .from('lps')
            .update({ longevity_score: longevityScore, longevity_checked_at: new Date().toISOString() })
            .eq('id', lp.id)
        }
      } else {
        console.log(`  Longevityスコア（キャッシュ済み）: ${longevityScore}`)
      }

      // 4. Effectiveness Score
      const analysis = lp.lp_analyses?.[0]
      if (analysis) {
        const effectiveness = calculateEffectivenessScore(
          { longevityScore },
          { score: croScore ?? 0 },
          {
            structure: analysis.structure_score,
            copy: analysis.copy_score,
            trust: analysis.trust_score,
            operation: analysis.longevity_score,
          }
        )
        console.log(`  Effectivenessスコア: ${effectiveness.effectivenessScore} (${effectiveness.grade})`)

        if (!isDryRun) {
          await supabase
            .from('lps')
            .update({
              effectiveness_score: effectiveness.effectivenessScore,
              effectiveness_grade: effectiveness.grade,
            })
            .eq('id', lp.id)
        }
        updated++
      } else {
        console.log('  分析データなし → スキップ')
        skipped++
      }
    } catch (e) {
      console.error(`  エラー:`, e)
      errors++
    }

    console.log()
  }

  console.log('=== 完了 ===')
  console.log(`inactive化: ${inactivated}件`)
  console.log(`スコア更新: ${updated}件`)
  console.log(`スキップ: ${skipped}件`)
  console.log(`エラー: ${errors}件`)
}

main().catch(console.error)
