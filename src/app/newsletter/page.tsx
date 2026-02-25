import { createServiceClient } from '@/lib/supabase'
import type { NewsletterIssue } from '@/types'
import { Header } from '@/components/public/header'
import { formatDate } from '@/lib/utils'
import { SubscribeForm } from '@/components/public/subscribe-form'

export const dynamic = 'force-dynamic'

async function getIssues(): Promise<NewsletterIssue[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('newsletter_issues')
    .select('*')
    .eq('status', 'sent')
    .order('issue_number', { ascending: false })
    .limit(20)

  return (data as NewsletterIssue[]) ?? []
}

export const metadata = {
  title: 'ニュースレター',
  description:
    '英語圏のCRO・LP研究を週次で日本語訳配信。ConversionXL、Unbounce Blog、Nielsen Norman GroupのデータをAIが翻訳・要約。',
}

export default async function NewsletterPage() {
  const issues = await getIssues()

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <Header />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-5 border border-[#d9dbd6] bg-white">
            <svg className="w-3.5 h-3.5 text-[#1d4ed8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-semibold text-[#1d4ed8]">週刊ニュースレター</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-[#111111] mb-4 tracking-tight">
            CRO・LP設計の最新知見を日本語で
          </h1>
          <p className="text-sm sm:text-base text-[#5e625c] max-w-xl mx-auto leading-relaxed">
            ConversionXL、Unbounce Blog、Nielsen Norman Groupなどの英語圏の実証的なデータをAIが翻訳・要約してお届けします。
          </p>
        </div>

        {/* Subscribe */}
        <div className="glass rounded-2xl p-6 sm:p-8 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#eef2ff]">
              <svg className="w-5 h-5 text-[#1d4ed8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-[#111111]">無料で購読する</h2>
              <p className="text-xs text-[#767b74]">週1回、CRO・LP設計の知見をお届け</p>
            </div>
          </div>
          <SubscribeForm />
          <p className="text-xs text-[#8a8f88] mt-3 text-center">
            いつでも配信停止できます。スパムは送りません。
          </p>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: '🌍', title: '英語圏の最新研究', desc: '日本語では手に入らないCROデータ' },
            { icon: '🤖', title: 'AI要約・翻訳', desc: '重要なインサイトを抽出' },
            { icon: '📬', title: '週1配信', desc: '読みやすいボリュームで' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="glass rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">{icon}</div>
              <p className="text-sm font-semibold text-[#111111] mb-1">{title}</p>
              <p className="text-xs text-[#767b74]">{desc}</p>
            </div>
          ))}
        </div>

        {/* Back issues */}
        <div>
          <h2 className="font-bold text-[#111111] text-lg mb-4">バックナンバー</h2>
          {issues.length === 0 ? (
            <div className="glass rounded-xl p-10 text-center">
              <p className="text-[#767b74]">バックナンバーは準備中です</p>
              <p className="text-xs text-[#8a8f88] mt-1">購読登録すると最新号からお届けします</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="glass glass-hover rounded-xl p-4 cursor-default"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#eef2ff] text-[#1d4ed8]">
                          #{issue.issue_number}
                        </span>
                        <span className="text-xs text-[#767b74]">{formatDate(issue.sent_at!)}</span>
                      </div>
                      <h3 className="font-medium text-[#111111] text-sm truncate">{issue.title}</h3>
                    </div>
                    <span className="text-xs text-[#8a8f88] shrink-0 ml-4">
                      {issue.recipient_count}人に配信
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
