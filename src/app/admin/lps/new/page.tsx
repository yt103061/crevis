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

type Stage = 'form' | 'confirming' | 'analyzing' | 'done'

interface NotLpWarning {
  lpConfidenceScore: number
  message: string
}

export default function NewLPPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('form')
  const [error, setError] = useState('')
  const [notLpWarning, setNotLpWarning] = useState<NotLpWarning | null>(null)
  const [form, setForm] = useState({
    url: '',
    industry: '',
    purpose: '',
    target_audience: '',
    ad_platform: '',
  })

  async function submitForm(force = false) {
    setError('')
    setNotLpWarning(null)
    setStage(force ? 'analyzing' : 'confirming')

    try {
      const res = await fetch('/api/admin/lps/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, force }),
      })

      const data = await res.json()

      if (res.status === 422 && data.error === 'NOT_LP') {
        // LPではないと判断された
        setNotLpWarning({
          lpConfidenceScore: data.lpConfidenceScore ?? 0,
          message: data.message ?? 'このページはLPではない可能性があります',
        })
        setStage('form')
        return
      }

      if (!res.ok) {
        setError(data.error ?? '登録に失敗しました')
        setStage('form')
        return
      }

      if (data.warning) {
        setError(`注意: ${data.warning}`)
      }

      setStage('done')
      router.push('/admin/lps')
    } catch {
      setError('通信エラーが発生しました')
      setStage('form')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitForm(false)
  }

  function updateField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const isLoading = stage === 'confirming' || stage === 'analyzing'

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-[#111111] mb-5">LP新規登録</h1>

      {/* NOT_LP警告バナー */}
      {notLpWarning && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">{notLpWarning.message}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                LP信頼スコア: <strong>{notLpWarning.lpConfidenceScore}/100</strong>
                （45以上でLP判定）
              </p>
              <p className="text-xs text-amber-600 mt-1">
                ニュース記事・コーポレートサイト・雑誌サイト等の可能性があります。本当にLPであれば強制登録できます。
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => submitForm(true)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50"
                >
                  {isLoading ? '処理中...' : '強制登録する'}
                </button>
                <button
                  onClick={() => setNotLpWarning(null)}
                  className="px-3 py-1.5 text-xs border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ローディング表示 */}
      {isLoading && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">
                {stage === 'confirming' ? 'ページを解析中...' : 'AI分析・登録処理中...'}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                {stage === 'confirming'
                  ? 'HTMLを取得してLP判定しています（数秒かかります）'
                  : 'AI分析・Wayback Machine確認・DB保存を行っています（30秒ほどかかる場合があります）'}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#d9dbd6] p-5 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
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
            disabled={isLoading}
            className="w-full border border-[#d9dbd6] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#111111] disabled:opacity-50"
          />
        </Field>

        <Field label="業界" required>
          <select
            value={form.industry}
            onChange={(e) => updateField('industry', e.target.value)}
            required
            disabled={isLoading}
            className="w-full border border-[#d9dbd6] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#111111] disabled:opacity-50"
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
            disabled={isLoading}
            className="w-full border border-[#d9dbd6] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#111111] disabled:opacity-50"
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
            disabled={isLoading}
            className="w-full border border-[#d9dbd6] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#111111] disabled:opacity-50"
          />
        </Field>

        <Field label="広告プラットフォーム">
          <select
            value={form.ad_platform}
            onChange={(e) => updateField('ad_platform', e.target.value)}
            disabled={isLoading}
            className="w-full border border-[#d9dbd6] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#111111] disabled:opacity-50"
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

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 bg-[#111111] text-white text-sm font-medium rounded-lg hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '処理中...' : '登録 + AI分析'}
          </button>
          <a
            href="/admin/lps"
            className="px-5 py-2 border border-[#d9dbd6] text-[#5e625c] text-sm font-medium rounded-lg hover:bg-[#f1f1ee]"
          >
            キャンセル
          </a>
        </div>
      </form>

      <div className="mt-4 p-4 bg-[#eef2ff] border border-[#c7d2fe] rounded-xl text-sm text-[#1d4ed8]">
        <p className="font-medium mb-1">登録処理フロー</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>HTMLを取得してLP構造を解析（LP判定スコア算出）</li>
          <li>Wayback Machineで掲載日数を推定</li>
          <li>AI（Gemini 2.5 Flash）でスコア・コメントを生成</li>
          <li>GitHub Actionsでスクリーンショットを取得（非同期）</li>
        </ol>
        <p className="text-xs text-[#3730a3] mt-2">
          ※ LP判定スコアが低い場合は確認ダイアログが表示されます（強制登録も可能）
        </p>
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
      <label className="block text-sm font-medium text-[#111111] mb-1">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
