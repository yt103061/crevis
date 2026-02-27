/**
 * CreVis Effectiveness Score（効果推定スコア）を算出する
 *
 * 3指標の重み付き合計:
 *   - Longevity (生存期間): 35%
 *   - CRO適合度: 35%
 *   - AI 4軸平均: 30%
 */

export type EffectivenessGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface EffectivenessResult {
  effectivenessScore: number
  grade: EffectivenessGrade
  breakdown: {
    longevity: number
    cro: number
    aiAverage: number
  }
}

function toGrade(score: number): EffectivenessGrade {
  if (score >= 85) return 'S'
  if (score >= 70) return 'A'
  if (score >= 55) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

export function calculateEffectivenessScore(
  longevity: { longevityScore: number },
  cro: { score: number },
  aiScores: { structure: number; copy: number; trust: number; operation: number }
): EffectivenessResult {
  const longevityVal = Math.max(0, Math.min(100, longevity.longevityScore))
  const croVal = Math.max(0, Math.min(100, cro.score))
  const aiAverage = Math.round(
    (aiScores.structure + aiScores.copy + aiScores.trust + aiScores.operation) / 4
  )

  const effectivenessScore = Math.round(
    longevityVal * 0.35 + croVal * 0.35 + aiAverage * 0.30
  )

  return {
    effectivenessScore,
    grade: toGrade(effectivenessScore),
    breakdown: {
      longevity: longevityVal,
      cro: croVal,
      aiAverage,
    },
  }
}
