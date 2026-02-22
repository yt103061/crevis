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
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.08) 0%, transparent 60%), #07070f',
      }}
    >
      <Header />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Hero */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-5"
            style={{
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
            }}
          >
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-semibold text-indigo-400">週刊ニュースレター</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white mb-4 tracking-tight">
            CRO・LP設計の<span className="text-gradient">最新知見</span>を日本語で
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            ConversionXL、Unbounce Blog、Nielsen Norman Groupなどの英語圏の実証的なデータをAIが翻訳・要約してお届けします。
          </p>
        </div>

        {/* Subscribe */}
        <div
          className="glass rounded-2xl p-6 sm:p-8 mb-10 animate-fade-in-up stagger-1"
          style={{ border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(99,102,241,0.15)' }}
            >
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-white">無料で購読する</h2>
              <p className="text-xs text-slate-400">週1回、CRO・LP設計の知見をお届け</p>
            </div>
          </div>
          <SubscribeForm />
          <p className="text-xs text-slate-600 mt-3 text-center">
            いつでも配信停止できます。スパムは送りません。
          </p>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 animate-fade-in-up stagger-2">
          {[
            { icon: '🌍', title: '英語圏の最新研究', desc: '日本語では手に入らないCROデータ' },
            { icon: '🤖', title: 'AI要約・翻訳', desc: '重要なインサイトを抽出' },
            { icon: '📬', title: '週1配信', desc: '読みやすいボリュームで' },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="glass rounded-xl p-4 text-center"
            >
              <div className="text-2xl mb-2">{icon}</div>
              <p className="text-sm font-semibold text-slate-200 mb-1">{title}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>

        {/* Back issues */}
        <div className="animate-fade-in-up stagger-3">
          <h2 className="font-bold text-white text-lg mb-4">バックナンバー</h2>
          {issues.length === 0 ? (
            <div className="glass rounded-xl p-10 text-center">
              <p className="text-slate-500">バックナンバーは準備中です</p>
              <p className="text-xs text-slate-600 mt-1">購読登録すると最新号からお届けします</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {issues.map((issue, i) => (
                <div
                  key={issue.id}
                  className="glass glass-hover rounded-xl p-4 cursor-default animate-fade-in-up"
                  style={{ animationDelay: `${0.3 + i * 0.05}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                        >
                          #{issue.issue_number}
                        </span>
                        <span className="text-xs text-slate-500">{formatDate(issue.sent_at!)}</span>
                      </div>
                      <h3 className="font-medium text-slate-200 text-sm truncate">{issue.title}</h3>
                    </div>
                    <span className="text-xs text-slate-600 shrink-0 ml-4">
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
