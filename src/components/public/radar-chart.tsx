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
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
          />
          <Radar
            name="スコア"
            dataKey="score"
            stroke="#818cf8"
            fill="#6366f1"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  )
}
