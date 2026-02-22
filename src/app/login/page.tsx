'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (mode === 'login') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) {
          setError(`ログインエラー: ${authError.message}`)
          setLoading(false)
          return
        }
        if (!data.session) {
          setError('セッションの取得に失敗しました。メール確認が完了しているか確認してください。')
          setLoading(false)
          return
        }
        setSuccess('ログイン成功！リダイレクト中...')
        await new Promise(r => setTimeout(r, 500))
        window.location.href = redirectTo
        return
      }

      // signup
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (authError) {
        setError(`登録エラー: ${authError.message}`)
        setLoading(false)
        return
      }
      if (data.session) {
        setSuccess('登録完了！リダイレクト中...')
        await new Promise(r => setTimeout(r, 500))
        window.location.href = redirectTo
        return
      }
      setSuccess('確認メールを送信しました。メールのリンクをクリックして登録を完了してください。')
    } catch (err) {
      setError(`予期しないエラー: ${err instanceof Error ? err.message : String(err)}`)
    }

    setLoading(false)
  }

  return (
    <div className="glass rounded-2xl p-6 sm:p-8 animate-scale-in">
      {/* Tab */}
      <div
        className="flex gap-0 mb-6 rounded-xl p-1"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <button
          onClick={() => { setMode('login'); setError(''); setSuccess('') }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            mode === 'login'
              ? 'bg-indigo-500/20 text-indigo-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          ログイン
        </button>
        <button
          onClick={() => { setMode('signup'); setError(''); setSuccess('') }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            mode === 'signup'
              ? 'bg-indigo-500/20 text-indigo-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          新規登録
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            className="flex items-start gap-2.5 p-3 rounded-xl text-sm break-all"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
          >
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div
            className="flex items-start gap-2.5 p-3 rounded-xl text-sm"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#6ee7b7' }}
          >
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            メールアドレス
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-dark"
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="input-dark"
            placeholder={mode === 'signup' ? '6文字以上' : ''}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              処理中...
            </>
          ) : (
            mode === 'login' ? 'ログイン' : '登録する'
          )}
        </button>
      </form>

      {mode === 'signup' && (
        <p className="text-xs text-slate-600 text-center mt-4">
          登録すると、コレクション機能やAIコメント全文が利用できます
        </p>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(99,102,241,0.1) 0%, transparent 60%), #07070f',
      }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-in-up">
          <Link href="/" className="inline-flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              C
            </div>
          </Link>
          <h1 className="text-xl font-bold text-white mt-4">CreVisにログイン</h1>
          <p className="text-slate-500 mt-1 text-sm">成果の出るLPギャラリー</p>
        </div>

        <Suspense fallback={<div className="glass rounded-2xl p-8 text-center text-slate-500 shimmer h-80" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-slate-600 mt-6">
          <Link href="/" className="hover:text-slate-400 transition-colors">
            ← ギャラリーに戻る
          </Link>
        </p>
      </div>
    </div>
  )
}
