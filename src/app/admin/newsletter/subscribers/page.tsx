import { createServiceClient } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import type { NewsletterSubscriber } from '@/types'

export const dynamic = 'force-dynamic'

export default async function NLSubscribersPage() {
  const supabase = createServiceClient()
  const { data: subscribers } = await supabase
    .from('newsletter_subscribers')
    .select('*')
    .order('subscribed_at', { ascending: false })
    .limit(500)

  const activeCount = (subscribers as NewsletterSubscriber[])?.filter(
    (s) => !s.unsubscribed_at
  ).length ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">購読者一覧</h1>
        <span className="text-sm text-gray-500">
          アクティブ: <span className="font-medium text-gray-900">{activeCount}人</span>
        </span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">メール</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">プラン</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">登録日</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(subscribers as NewsletterSubscriber[])?.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{sub.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    sub.plan === 'pro' ? 'bg-indigo-100 text-indigo-700' :
                    sub.plan === 'team' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {sub.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(sub.subscribed_at)}</td>
                <td className="px-4 py-3">
                  {sub.unsubscribed_at ? (
                    <span className="text-xs text-red-500">退会済み ({formatDate(sub.unsubscribed_at)})</span>
                  ) : (
                    <span className="text-xs text-green-600">購読中</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
