import Link from 'next/link'
import Image from 'next/image'
import type { LPWithAnalysis } from '@/types'
import { scoreBg } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface LPCardProps {
  lp: LPWithAnalysis
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

export function LPCard({ lp }: LPCardProps) {
  const analysis = lp.lp_analyses?.[0]

  return (
    <Link href={`/lp/${lp.id}`} className="group block">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all duration-200 hover:-translate-y-0.5">
        {/* スクリーンショット */}
        <div className="relative aspect-[16/9] overflow-hidden">
          {lp.screenshot_url ? (
            <Image
              src={lp.screenshot_url}
              alt={lp.title ?? lp.url}
              fill
              className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <span className="text-xs text-gray-400 font-medium truncate max-w-[80%]">
                {getHostname(lp.url)}
              </span>
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
          {/* 未分析バッジ */}
          {!analysis && (
            <div className="absolute top-2 right-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-white/80 text-gray-500 shadow-sm">
                分析中
              </span>
            </div>
          )}
        </div>

        {/* コンテンツ */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {lp.industry && (
              <Badge variant="outline">{lp.industry}</Badge>
            )}
            {lp.purpose && (
              <Badge variant="default">{lp.purpose}</Badge>
            )}
          </div>

          <p className="text-sm font-semibold text-gray-900 line-clamp-1 mb-0.5">
            {lp.title ?? getHostname(lp.url)}
          </p>
          <p className="text-xs text-gray-400 truncate mb-3">
            {getHostname(lp.url)}
          </p>

          {analysis ? (
            <div className="flex gap-3 pt-3 border-t border-gray-100">
              <ScoreItem label="構造" score={analysis.structure_score} />
              <ScoreItem label="コピー" score={analysis.copy_score} />
              <ScoreItem label="信頼" score={analysis.trust_score} />
              <ScoreItem label="稼働" score={analysis.longevity_score} />
            </div>
          ) : (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex gap-3">
                {['構造', 'コピー', '信頼', '稼働'].map((label) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-300">{label}</span>
                    <div className="w-6 h-2 bg-gray-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function ScoreItem({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-bold ${
        score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-500'
      }`}>
        {score}
      </span>
    </div>
  )
}
