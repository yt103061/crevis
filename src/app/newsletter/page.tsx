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
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* ヒーロー */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">CreVis Newsletter</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            英語圏のCRO・LP研究を週次で日本語訳配信。
            ConversionXL、Unbounce Blog、Nielsen Norman Groupなどの
            実証的なデータをAIが翻訳・要約してお届けします。
          </p>
        </div>

        {/* 購読フォーム */}
        <div className="bg-white rounded-xl border border-indigo-200 p-6 mb-10 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-1">無料で購読する</h2>
          <p className="text-sm text-gray-500 mb-4">週1回、CRO・LP設計の知見をお届けします</p>
          <SubscribeForm />
          <p className="text-xs text-gray-400 mt-2">
            いつでも配信停止できます。スパムは送りません。
          </p>
        </div>

        {/* バックナンバー */}
        <h2 className="font-bold text-gray-900 mb-4">バックナンバー</h2>
        {issues.length === 0 ? (
          <p className="text-gray-400 text-center py-8">バックナンバーは準備中です</p>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">#{issue.issue_number}</span>
                      <span className="text-xs text-gray-400">{formatDate(issue.sent_at!)}</span>
                    </div>
                    <h3 className="font-medium text-gray-900">{issue.title}</h3>
                  </div>
                  <span className="text-xs text-gray-400">
                    {issue.recipient_count}人に配信
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
