'use client'

import { useState } from 'react'

export function SeedButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState<Record<string, unknown> | null>(null)

  async function handleSeed() {
    setStatus('loading')
    setMessage('サンプルデータを登録中... LP分析と記事翻訳をAIで実行しています（1〜2分）')

    try {
      const res = await fetch('/api/admin/seed', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? '登録に失敗しました')
        return
      }

      setStatus('done')
      setMessage(data.message)
      setDetails(data.results)
    } catch (err) {
      setStatus('error')
      setMessage(`エラー: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (status === 'done') {
    return (
      <div>
        <div className="flex items-center gap-2 text-green-700 font-medium text-sm mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {message}
        </div>
        {details && (
          <div className="text-xs text-indigo-600 space-y-0.5">
            <p>LP: {(details.lps as { created: number })?.created ?? 0}件登録, {(details.lps as { analyzed: number })?.analyzed ?? 0}件分析完了</p>
            <p>NLソース: {(details.sources as { created: number })?.created ?? 0}件登録</p>
            <p>記事: {(details.articles as { processed: number })?.processed ?? 0}件収集・翻訳完了</p>
          </div>
        )}
        <button
          onClick={() => window.location.reload()}
          className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          ダッシュボードを更新
        </button>
      </div>
    )
  }

  return (
    <div>
      {message && (
        <p className={`text-sm mb-3 ${status === 'error' ? 'text-red-600' : 'text-indigo-600'}`}>
          {status === 'loading' && (
            <span className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-2 align-middle" />
          )}
          {message}
        </p>
      )}
      <button
        onClick={handleSeed}
        disabled={status === 'loading'}
        className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait"
      >
        {status === 'loading' ? 'AI処理中...' : 'サンプルデータを自動登録'}
      </button>
    </div>
  )
}
