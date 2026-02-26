'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const INDUSTRIES = [
  '美容・コスメ', '健康・医療', 'フィットネス', '教育・スクール',
  'IT・SaaS', 'EC・通販', '不動産', '金融・保険', '飲食', 'その他',
]

const PURPOSES = ['リード獲得', '商品販売', '予約獲得', '会員登録', '資料請求', 'お問い合わせ']

export default function NewLPPage() {
  const router = useRouter()
  const [loadingStep, setLoadingStep] = useState<'idle' | 'analysis' | 'ai'>('idle')
  const [error, setError] = useState('')
  const [lpScoreWarning, setLpScoreWarning] = useState<number | null>(null)
  const [form, setForm] = useState({
    url: '', industry: '', purpose: '', target_audience: '', ad_platform: '', force: false,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLpScoreWarning(null)
    setLoadingStep('analysis')

    try {
      const res = await fetch('/api/admin/lps/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (res.status === 422 && data.requiresForce) {
        setLpScoreWarning(data.lpConfidenceScore ?? null)
        setError(`LP判定スコアが低いため登録できませんでした（${data.lpConfidenceScore ?? 0}点）。必要なら強制登録を有効化してください。`)
        return
      }

      if (!res.ok) {
        setError(data.error ?? '登録に失敗しました')
        return
      }

      setLoadingStep('ai')
      if (data.warning) alert(`LP登録完了（${data.warning}）`)
      router.push('/admin/lps')
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoadingStep('idle')
    }
  }

  function updateField(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const loading = loadingStep !== 'idle'

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">LP新規登録</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>}
        {lpScoreWarning !== null && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-md text-sm text-amber-800">LP判定スコア: {lpScoreWarning}</div>
        )}

        <Field label="LP URL" required>
          <input type="url" value={form.url} onChange={(e) => updateField('url', e.target.value)} placeholder="https://example.com/lp" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </Field>

        <Field label="業界" required>
          <select value={form.industry} onChange={(e) => updateField('industry', e.target.value)} required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">選択してください</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>

        <Field label="目的" required>
          <select value={form.purpose} onChange={(e) => updateField('purpose', e.target.value)} required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">選択してください</option>
            {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>

        <Field label="ターゲット">
          <input type="text" value={form.target_audience} onChange={(e) => updateField('target_audience', e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </Field>

        <Field label="広告プラットフォーム">
          <select value={form.ad_platform} onChange={(e) => updateField('ad_platform', e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">不明 / 直接</option><option value="meta">Meta</option><option value="google">Google</option><option value="tiktok">TikTok</option><option value="twitter">X</option><option value="line">LINE</option><option value="other">その他</option>
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.force} onChange={(e) => updateField('force', e.target.checked)} />
          LP判定をスキップして強制登録
        </label>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-md disabled:opacity-50">
            {loadingStep === 'analysis' ? 'ページ解析中...' : loadingStep === 'ai' ? 'AI分析中...' : '登録 + AI分析'}
          </button>
          <a href="/admin/lps" className="px-6 py-2 border border-gray-300 text-gray-700 text-sm rounded-md">キャンセル</a>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>{children}</div>
}
