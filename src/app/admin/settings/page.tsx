export default function AdminSettingsPage() {
  const aiProvider = process.env.AI_PROVIDER ?? 'gemini'
  const hasGeminiKey = !!process.env.GEMINI_API_KEY
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
  const hasResendKey = !!process.env.RESEND_API_KEY
  const hasR2 = !!process.env.CLOUDFLARE_R2_ACCOUNT_ID

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">設定</h1>

      <div className="space-y-6">
        {/* AI設定 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">AI設定</h2>
          <div className="space-y-3">
            <ConfigRow label="AI_PROVIDER" value={aiProvider} />
            <ConfigRow
              label="現在のモデル"
              value={
                aiProvider === 'claude'
                  ? 'Claude claude-sonnet-4-20250514 (Phase 2)'
                  : 'Gemini 2.5 Flash (無料枠)'
              }
            />
            <ConfigRow
              label="GEMINI_API_KEY"
              value={hasGeminiKey ? '設定済み ✓' : '未設定'}
              ok={hasGeminiKey}
            />
            <ConfigRow
              label="ANTHROPIC_API_KEY"
              value={hasAnthropicKey ? '設定済み ✓' : '未設定（Phase 2で必要）'}
              ok={hasAnthropicKey}
              warn={!hasAnthropicKey}
            />
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-blue-700">
            <p className="font-medium mb-1">AI切り替え方法</p>
            <p>環境変数 <code className="bg-blue-100 px-1 rounded">AI_PROVIDER</code> を
              <code className="bg-blue-100 px-1 rounded ml-1">gemini</code> →
              <code className="bg-blue-100 px-1 rounded ml-1">claude</code> に変更するだけで全AI処理が切り替わります。
            </p>
          </div>
        </section>

        {/* メール設定 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">メール設定（Resend）</h2>
          <div className="space-y-3">
            <ConfigRow
              label="RESEND_API_KEY"
              value={hasResendKey ? '設定済み ✓' : '未設定'}
              ok={hasResendKey}
            />
            <ConfigRow
              label="RESEND_FROM_EMAIL"
              value={process.env.RESEND_FROM_EMAIL ?? '未設定'}
              ok={!!process.env.RESEND_FROM_EMAIL}
            />
          </div>
        </section>

        {/* ストレージ設定 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">ストレージ設定（Cloudflare R2）</h2>
          <div className="space-y-3">
            <ConfigRow
              label="R2設定"
              value={hasR2 ? '設定済み ✓' : '未設定'}
              ok={hasR2}
            />
            <ConfigRow
              label="バケット"
              value={process.env.CLOUDFLARE_R2_BUCKET_NAME ?? '未設定'}
              ok={!!process.env.CLOUDFLARE_R2_BUCKET_NAME}
            />
          </div>
        </section>

        {/* コスト目安 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">フェーズ別月額コスト目安</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">条件</th>
                  <th className="text-left py-2 text-gray-500 font-medium">対応</th>
                  <th className="text-right py-2 text-gray-500 font-medium">追加コスト</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2 text-gray-700">Phase 1（現在）</td>
                  <td className="py-2 text-gray-600">Gemini無料枠</td>
                  <td className="py-2 text-right font-medium text-green-600">¥0/月</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-700">収益安定後</td>
                  <td className="py-2 text-gray-600">AI_PROVIDER=claude</td>
                  <td className="py-2 text-right font-medium text-gray-700">~¥100/月</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-700">NL読者300人超</td>
                  <td className="py-2 text-gray-600">Resend Pro</td>
                  <td className="py-2 text-right font-medium text-gray-700">+¥3,000/月</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-700">DB 500MB超</td>
                  <td className="py-2 text-gray-600">Supabase Pro</td>
                  <td className="py-2 text-right font-medium text-gray-700">+¥3,750/月</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

function ConfigRow({
  label,
  value,
  ok,
  warn,
}: {
  label: string
  value: string
  ok?: boolean
  warn?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 font-mono">{label}</span>
      <span
        className={`text-sm font-medium ${
          ok ? 'text-green-600' : warn ? 'text-yellow-600' : 'text-gray-700'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
