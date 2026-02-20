import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function getStats() {
  const supabase = createServiceClient()

  const [lpCount, subscriberCount, issueCount, articleCount] = await Promise.all([
    supabase.from('lps').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .is('unsubscribed_at', null),
    supabase
      .from('newsletter_issues')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent'),
    supabase
      .from('nl_articles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  return {
    lps: lpCount.count ?? 0,
    subscribers: subscriberCount.count ?? 0,
    issues: issueCount.count ?? 0,
    pendingArticles: articleCount.count ?? 0,
  }
}

export default async function AdminDashboard() {
  const stats = await getStats()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ダッシュボード</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="登録LP数" value={stats.lps} unit="件" color="indigo" />
        <StatCard label="NL購読者" value={stats.subscribers} unit="人" color="green" />
        <StatCard label="配信済み号数" value={stats.issues} unit="号" color="blue" />
        <StatCard label="未処理記事" value={stats.pendingArticles} unit="件" color="yellow" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuickAction
          title="LP登録"
          description="新しいランディングページを登録してAI分析を実行します"
          href="/admin/lps/new"
          buttonLabel="LP を登録する"
        />
        <QuickAction
          title="記事収集"
          description="RSSソースから最新記事を収集してAI処理します"
          href="/admin/newsletter/articles"
          buttonLabel="記事一覧を見る"
        />
      </div>

      <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="font-semibold text-gray-700 mb-2">AI設定状態</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">AI_PROVIDER:</span>
          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
            {process.env.AI_PROVIDER ?? 'gemini'}
          </span>
          <span className="text-xs text-gray-400">
            {(process.env.AI_PROVIDER ?? 'gemini') === 'gemini'
              ? '(Gemini 2.5 Flash - 無料枠)'
              : '(Claude claude-sonnet-4-20250514 - Phase 2)'}
          </span>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  unit,
  color,
}: {
  label: string
  value: number
  unit: string
  color: 'indigo' | 'green' | 'blue' | 'yellow'
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  }

  return (
    <div className={`p-4 rounded-lg border ${colors[color]} bg-white`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1">
        {value}
        <span className="text-base font-normal text-gray-400 ml-1">{unit}</span>
      </p>
    </div>
  )
}

function QuickAction({
  title,
  description,
  href,
  buttonLabel,
}: {
  title: string
  description: string
  href: string
  buttonLabel: string
}) {
  return (
    <div className="p-5 bg-white rounded-lg border border-gray-200">
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <a
        href={href}
        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
      >
        {buttonLabel}
      </a>
    </div>
  )
}
