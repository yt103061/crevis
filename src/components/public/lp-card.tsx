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
  if (score >= 80) return '#4ade80'
  if (score >= 65) return '#facc15'
  return '#f87171'
}

function scoreGradient(score: number) {
  if (score >= 80) return 'linear-gradient(135deg, #166534, #16a34a)'
  if (score >= 65) return 'linear-gradient(135deg, #854d0e, #ca8a04)'
  return 'linear-gradient(135deg, #7f1d1d, #dc2626)'
}

export function LPCard({ lp, featured = false, priority = false }: LPCardProps) {
  const analysis = lp.lp_analyses?.[0]
  const hostname = getHostname(lp.url)

  return (
    <Link href={`/lp/${lp.id}`} className="group block h-full">
      <div
        className="glass glass-hover rounded-2xl overflow-hidden h-full flex flex-col"
        style={{ willChange: 'transform' }}
      >
        {/* スクリーンショット */}
        <div className={`relative overflow-hidden ${featured ? 'flex-1' : 'aspect-video'}`}>
          {lp.screenshot_url ? (
            <>
              <Image
                src={lp.screenshot_url}
                alt={lp.title ?? hostname}
                fill
                className="object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
                sizes={
                  featured
                    ? '(max-width: 768px) 100vw, 66vw'
                    : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw'
                }
                priority={priority}
                loading={priority ? 'eager' : 'lazy'}
              />
              {/* 下部グラデーションオーバーレイ */}
              <div
                className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
                style={{
                  background: 'linear-gradient(to top, rgba(7,7,15,0.7) 0%, transparent 100%)',
                }}
              />
            </>
          ) : (
            /* スクリーンショットなしのプレースホルダー */
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.12) 0%, rgba(7,7,15,0.8) 70%)',
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              </div>
              <span className="text-xs text-slate-500 font-medium">{hostname}</span>
              <span
                className="text-[10px] px-2.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: '#64748b',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                スクリーンショット取得中
              </span>
            </div>
          )}

          {/* スコアバッジ */}
          {analysis && (
            <div className="absolute top-3 right-3">
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-sm font-black text-white"
                style={{
                  background: scoreGradient(analysis.total_score),
                  boxShadow: `0 4px 12px ${scoreColor(analysis.total_score)}33`,
                }}
              >
                {analysis.total_score}
              </div>
            </div>
          )}
        </div>

        {/* コンテンツ */}
        <div className="p-4 space-y-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* バッジ */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {lp.industry && <DarkBadge>{lp.industry}</DarkBadge>}
            {lp.purpose && <DarkBadge accent>{lp.purpose}</DarkBadge>}
          </div>

          {/* タイトル + ドメイン */}
          <div>
            <p className="text-sm font-semibold text-slate-100 line-clamp-1">
              {lp.title ?? hostname}
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{hostname}</p>
          </div>

          {/* スコアバー */}
          {analysis ? (
            <div
              className="flex items-center gap-3 pt-2.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              {[
                { label: '構造', score: analysis.structure_score },
                { label: 'コピー', score: analysis.copy_score },
                { label: '信頼', score: analysis.trust_score },
                { label: '稼働', score: analysis.longevity_score },
              ].map(({ label, score }) => (
                <div key={label} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[10px] text-slate-500">{label}</span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: scoreColor(score) }}
                  >
                    {score}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="flex items-center gap-3 pt-2.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              {['構造', 'コピー', '信頼', '稼働'].map((label) => (
                <div key={label} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[10px] text-slate-600">{label}</span>
                  <div className="shimmer w-full h-3 rounded" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function DarkBadge({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium"
      style={
        accent
          ? {
              background: 'rgba(99,102,241,0.15)',
              color: '#818cf8',
              border: '1px solid rgba(99,102,241,0.2)',
            }
          : {
              background: 'rgba(255,255,255,0.06)',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.08)',
            }
      }
    >
      {children}
    </span>
  )
}
