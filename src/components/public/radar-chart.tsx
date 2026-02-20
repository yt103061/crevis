'use client'

import { RadarChart as RechartsRadar, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import type { LPAnalysis } from '@/types'

interface RadarChartProps {
  analysis: LPAnalysis
}

export function RadarChart({ analysis }: RadarChartProps) {
  const data = [
    { subject: '構造', score: analysis.structure_score },
    { subject: 'コピー', score: analysis.copy_score },
    { subject: '信頼', score: analysis.trust_score },
    { subject: '稼働', score: analysis.longevity_score },
  ]

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <Radar
            name="スコア"
            dataKey="score"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  )
}
