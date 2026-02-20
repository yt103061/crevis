'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const INDUSTRIES = [
  '美容・コスメ', '健康・医療', 'フィットネス', '教育・スクール',
  'IT・SaaS', 'EC・通販', '不動産', '金融・保険', '飲食', 'その他',
]

const PURPOSES = [
  'リード獲得', '商品販売', '予約獲得', '会員登録', '資料請求', 'お問い合わせ',
]

export default function NewLPPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    url: '',
    industry: '',
    purpose: '',
    target_audience: '',
    ad_platform: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/lps/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '登録に失敗しました')
        return
      }

      if (data.warning) {
        alert(`LP登録完了（${data.warning}）`)
      }

      router.push('/admin/lps')
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  function updateField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">LP新規登録</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        <Field label="LP URL" required>
          <input
            type="url"
            value={form.url}
            onChange={(e) => updateField('url', e.target.value)}
            placeholder="https://example.com/lp"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </Field>

        <Field label="業界" required>
          <select
            value={form.industry}
            onChange={(e) => updateField('industry', e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">選択してください</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </Field>

        <Field label="目的" required>
          <select
            value={form.purpose}
            onChange={(e) => updateField('purpose', e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">選択してください</option>
            {PURPOSES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>

        <Field label="ターゲット">
          <input
            type="text"
            value={form.target_audience}
            onChange={(e) => updateField('target_audience', e.target.value)}
            placeholder="例: 20代女性、ダイエット志向"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </Field>

        <Field label="広告プラットフォーム">
          <select
            value={form.ad_platform}
            onChange={(e) => updateField('ad_platform', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">不明 / 直接</option>
            <option value="meta">Meta（Facebook/Instagram）</option>
            <option value="google">Google</option>
            <option value="tiktok">TikTok</option>
            <option value="twitter">X（Twitter）</option>
            <option value="line">LINE</option>
            <option value="other">その他</option>
          </select>
        </Field>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'AI分析中...' : '登録 + AI分析'}
          </button>
          <a
            href="/admin/lps"
            className="px-6 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
          >
            キャンセル
          </a>
        </div>
      </form>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
        <p className="font-medium mb-1">登録後の処理フロー</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>SupabaseにLPデータを保存</li>
          <li>AI（{process.env.NEXT_PUBLIC_AI_PROVIDER ?? 'Gemini 2.5 Flash'}）でスコアとコメントを生成</li>
          <li>GitHub Actionsでスクリーンショットを取得（非同期）</li>
        </ol>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
