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

/** ドメイン文字列から一意なグラデーション色を生成 */
function domainToGradient(hostname: string): string {
  let hash = 0
  for (let i = 0; i < hostname.length; i++) {
    hash = hostname.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `linear-gradient(135deg, hsl(${hue},60%,70%), hsl(${(hue + 60) % 360},55%,60%))`
}

/** Effectiveness グレードバッジ */
function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade || grade === 'D') return null

  const styles: Record<string, string> = {
    S: 'bg-amber-400 text-white',
    A: 'bg-[#1d4ed8] text-white',
    B: 'bg-[#767b74] text-white',
    C: 'bg-[#e3e5e0] text-[#5e625c]',
  }

  return (
    <div className={`absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${styles[grade] ?? ''}`}>
      {grade}
    </div>
  )
}

export function LPCard({ lp, featured = false, priority = false }: LPCardProps) {
  const analysis = lp.lp_analyses?.[0]
  const hostname = getHostname(lp.url)
  const initial = hostname.charAt(0).toUpperCase()

  return (
    <Link href={`/lp/${lp.id}`} className="group block h-full">
      <div className="glass glass-hover rounded-lg overflow-hidden h-full flex flex-col">
        {/* 画像エリア: 16:9 固定 */}
        <div className={`relative overflow-hidden bg-[#f1f1ee] ${featured ? 'flex-1 min-h-[200px]' : 'aspect-video'}`}>
          {lp.screenshot_url ? (
            <Image
              src={lp.screenshot_url}
              alt={lp.title ?? hostname}
              fill
              className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
              sizes={
                featured
                  ? '(max-width: 640px) 100vw, (max-width: 1024px) 66vw, 50vw'
                  : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
              }
              priority={priority}
              loading={priority ? 'eager' : 'lazy'}
              placeholder="blur"
              blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            />
          ) : (
            /* スクショなし: ドメイン頭文字 + グラデーション背景 */
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-1"
              style={{ background: domainToGradient(hostname) }}
            >
              <span className="text-white/30 text-[5rem] font-black leading-none select-none">
                {initial}
              </span>
              <span className="text-white text-xs font-medium opacity-90">{hostname}</span>
            </div>
          )}

          {/* Effectiveness グレードバッジ */}
          <GradeBadge grade={lp.effectiveness_grade ?? null} />

          {/* AI スコアバッジ */}
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
