import Link from 'next/link'
import Image from 'next/image'
import type { LPWithAnalysis } from '@/types'

interface LPCardProps {
  lp: LPWithAnalysis
  featured?: boolean
  priority?: boolean
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-700'
  if (score >= 65) return 'text-amber-700'
  return 'text-rose-700'
}

export function LPCard({ lp, featured = false, priority = false }: LPCardProps) {
  const analysis = lp.lp_analyses?.[0]
  const hostname = getHostname(lp.url)

  return (
    <Link href={`/lp/${lp.id}`} className="group block h-full">
      <div className="glass glass-hover rounded-lg overflow-hidden h-full flex flex-col">
        <div className={`relative overflow-hidden bg-[#f1f1ee] ${featured ? 'flex-1' : 'aspect-video'}`}>
          {lp.screenshot_url ? (
            <Image
              src={lp.screenshot_url}
              alt={lp.title ?? hostname}
              fill
              className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
              sizes={featured ? '(max-width: 768px) 100vw, 66vw' : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw'}
              priority={priority}
              loading={priority ? 'eager' : 'lazy'}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-[#6b7068]">スクリーンショット取得中</div>
          )}

          {analysis && (
            <div className="absolute top-2 right-2 bg-white/95 border border-[#d9dbd6] rounded px-2 py-0.5 text-xs font-semibold text-[#111] font-num">
              {analysis.total_score}
            </div>
          )}
        </div>

        <div className="p-4 space-y-2.5 border-t border-[#e2e4df]">
          <div className="flex items-center gap-1.5 flex-wrap">
            {lp.industry && <Tag>{lp.industry}</Tag>}
            {lp.purpose && <Tag accent>{lp.purpose}</Tag>}
          </div>

          <div>
            <p className="text-sm font-medium text-[#111] line-clamp-1">{lp.title ?? hostname}</p>
            <p className="text-xs text-[#6b7068] truncate mt-0.5">{hostname}</p>
          </div>

          {analysis ? (
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-[#eceee9]">
              {[
                { label: '構造', score: analysis.structure_score },
                { label: 'コピー', score: analysis.copy_score },
                { label: '信頼', score: analysis.trust_score },
                { label: '稼働', score: analysis.longevity_score },
              ].map(({ label, score }) => (
                <div key={label} className="text-center">
                  <p className="text-[10px] text-[#767b74]">{label}</p>
                  <p className={`text-xs font-semibold font-num ${scoreColor(score)}`}>{score}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="pt-2 border-t border-[#eceee9] text-[11px] text-[#767b74]">分析待ち</div>
          )}
        </div>
      </div>
    </Link>
  )
}

function Tag({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${
        accent ? 'bg-[#eef2ff] text-[#1d4ed8] border-[#c7d2fe]' : 'bg-[#f1f1ee] text-[#5e625c] border-[#d9dbd6]'
      }`}
    >
      {children}
    </span>
  )
}
