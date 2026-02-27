import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import type { NewsletterIssue, NLArticle } from '@/types'
import { Header } from '@/components/public/header'
import { formatDate } from '@/lib/utils'
import { getAuthUser, getUserPlan, canAccessFullNewsletter } from '@/lib/auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getIssue(issueNumber: number): Promise<NewsletterIssue | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('newsletter_issues')
    .select('*')
    .eq('issue_number', issueNumber)
    .eq('status', 'sent')
    .maybeSingle()
  return (data as NewsletterIssue) ?? null
}

async function getFeaturedArticles(articleIds: string[]): Promise<NLArticle[]> {
  if (!articleIds.length) return []
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('nl_articles')
    .select('*')
    .in('id', articleIds)
  return (data as NLArticle[]) ?? []
}

export async function generateMetadata({ params }: { params: { issue_number: string } }) {
  const issueNumber = Number(params.issue_number)
  if (isNaN(issueNumber)) return {}
  const issue = await getIssue(issueNumber)
  if (!issue) return {}
  return {
    title: `#${issue.issue_number} ${issue.title} | CreVis Newsletter`,
    description: `CreVis週刊ニュースレター第${issue.issue_number}号。英語圏のCRO・LP知見を日本語でお届けします。`,
  }
}

export default async function NewsletterIssuePage({ params }: { params: { issue_number: string } }) {
  const issueNumber = Number(params.issue_number)
  if (isNaN(issueNumber)) notFound()

  const [issue, user] = await Promise.all([getIssue(issueNumber), getAuthUser()])
  if (!issue) notFound()

  const plan = user ? await getUserPlan(user.id) : 'free'
  const canReadFull = canAccessFullNewsletter(plan)

  const articleIds = issue.featured_articles ?? []
  const articles = await getFeaturedArticles(articleIds)

  // Sort articles by the order they appear in featured_articles
  const sortedArticles = articleIds
    .map((id) => articles.find((a) => a.id === id))
    .filter((a): a is NLArticle => !!a)

  const evidenceBadge = (level: NLArticle['evidence_level']) => {
    if (level === 'high') return { label: '証拠レベル: 高', cls: 'bg-green-100 text-green-800' }
    if (level === 'medium') return { label: '証拠レベル: 中', cls: 'bg-yellow-100 text-yellow-800' }
    if (level === 'low') return { label: '証拠レベル: 低', cls: 'bg-gray-100 text-gray-600' }
    return null
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <Header />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#8a8f88] mb-6">
          <Link href="/newsletter" className="hover:text-[#1d4ed8]">ニュースレター</Link>
          <span>/</span>
          <span>#{issue.issue_number}</span>
        </div>

        {/* Issue header */}
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#eef2ff] text-[#1d4ed8]">
              #{issue.issue_number}
            </span>
            {issue.sent_at && (
              <span className="text-xs text-[#767b74]">{formatDate(issue.sent_at)}</span>
            )}
            {issue.recipient_count && (
              <span className="text-xs text-[#8a8f88]">{issue.recipient_count}人に配信</span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#111111] mb-2">{issue.title}</h1>
          <p className="text-sm text-[#767b74]">
            英語圏のCRO・LP設計の最新知見を日本語でお届けします。
          </p>
        </div>

        {/* Articles */}
        {sortedArticles.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center">
            <p className="text-[#767b74]">記事が見つかりませんでした</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedArticles.map((article, index) => {
              const isFirstArticle = index === 0
              const showFull = canReadFull || isFirstArticle

              const badge = evidenceBadge(article.evidence_level)

              return (
                <div key={article.id} className="glass rounded-2xl overflow-hidden">
                  <div className="p-6">
                    {/* Article header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h2 className="font-bold text-[#111111] text-base sm:text-lg leading-snug">
                        {article.translated_title_ja ?? article.original_title}
                      </h2>
                      {badge && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>

                    {/* Summary */}
                    {article.summary_ja && (
                      <p className={`text-sm text-[#333] leading-relaxed mb-4 ${!showFull && !isFirstArticle ? 'line-clamp-2' : ''}`}>
                        {article.summary_ja}
                      </p>
                    )}

                    {showFull && (
                      <>
                        {/* Key insights */}
                        {article.key_insights && article.key_insights.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-bold text-[#767b74] uppercase tracking-wider mb-2">Key Insights</p>
                            <ul className="space-y-2">
                              {article.key_insights.map((insight, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-[#333]">
                                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#1d4ed8] shrink-0" />
                                  <span>{insight}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Actionable tips */}
                        {article.actionable_tips && article.actionable_tips.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-bold text-[#767b74] uppercase tracking-wider mb-2">Actionable Tips</p>
                            <ul className="space-y-2">
                              {article.actionable_tips.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-[#333]">
                                  <span className="mt-0.5 text-[#1d4ed8]">✓</span>
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Source link */}
                        <a
                          href={article.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#1d4ed8] hover:underline"
                        >
                          元記事を読む
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </>
                    )}

                    {/* Preview-only teaser for non-first articles when not canReadFull */}
                    {!showFull && !canReadFull && (
                      <p className="text-xs text-[#8a8f88] italic">Readerプランで全文を読む...</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Paywall CTA for free users */}
        {!canReadFull && sortedArticles.length > 1 && (
          <div className="mt-8 glass rounded-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#f7f7f5] to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-[#eef2ff] flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[#1d4ed8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-bold text-[#111111] text-lg mb-2">
                残り{sortedArticles.length - 1}記事はReaderプランで読めます
              </h3>
              <p className="text-sm text-[#5e625c] mb-5 max-w-sm mx-auto">
                Readerプラン（月額¥500）でKey Insights・Actionable Tipsを含む全記事が読み放題。
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/pricing" className="btn-primary">
                  Readerプランに登録する
                </Link>
                {!user && (
                  <Link href="/login" className="text-sm text-[#1d4ed8] hover:underline">
                    すでにアカウントをお持ちの方
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between">
          <Link
            href="/newsletter"
            className="flex items-center gap-2 text-sm text-[#5e625c] hover:text-[#111111]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            バックナンバー一覧
          </Link>
        </div>
      </div>
    </div>
  )
}
