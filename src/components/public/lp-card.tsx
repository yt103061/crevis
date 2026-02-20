import Link from 'next/link'
import Image from 'next/image'
import type { LPWithAnalysis } from '@/types'
import { scoreBg } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface LPCardProps {
  lp: LPWithAnalysis
}

export function LPCard({ lp }: LPCardProps) {
  const analysis = lp.lp_analyses?.[0]

  return (
    <Link href={`/lp/${lp.id}`} className="group block">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all duration-200">
        {/* スクリーンショット */}
        <div className="relative aspect-[16/9] bg-gray-100 overflow-hidden">
          {lp.screenshot_url ? (
            <Image
              src={lp.screenshot_url}
              alt={lp.title ?? lp.url}
              fill
              className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {/* スコアバッジ */}
          {analysis && (
            <div className="absolute top-2 right-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold shadow-sm ${scoreBg(analysis.total_score)}`}>
                {analysis.total_score}
              </span>
            </div>
          )}
        </div>

        {/* コンテンツ */}
        <div className="p-4">
          <div className="flex items-start gap-2 mb-2">
            {lp.industry && (
              <Badge variant="outline">{lp.industry}</Badge>
            )}
            {lp.purpose && (
              <Badge variant="default">{lp.purpose}</Badge>
            )}
          </div>

          <p className="text-sm font-medium text-gray-900 line-clamp-1 mb-1">
            {lp.title ?? new URL(lp.url).hostname}
          </p>

          {analysis && (
            <div className="flex gap-3 mt-3">
              <ScoreItem label="構造" score={analysis.structure_score} />
              <ScoreItem label="コピー" score={analysis.copy_score} />
              <ScoreItem label="信頼" score={analysis.trust_score} />
              <ScoreItem label="稼働" score={analysis.longevity_score} />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function ScoreItem({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-semibold ${
        score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-500'
      }`}>
        {score}
      </span>
    </div>
  )
}
