'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/'
  const callbackError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const callbackErrorMessage =
    callbackError === 'config_missing'
      ? '認証設定が未完了です。管理者にお問い合わせください。'
      : callbackError === 'auth_callback_failed'
        ? 'メール認証の処理に失敗しました。再度ログインをお試しください。'
        : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (mode === 'login') {
        if (typeof supabase.auth.signInWithPassword !== 'function') {
          setError('ログイン設定が未完了です。管理者にお問い合わせください。')
          return
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setError(error.message)
        } else {
          router.push(redirectTo)
          router.refresh()
        }
      } else {
        if (typeof supabase.auth.signUp !== 'function') {
          setError('新規登録設定が未完了です。管理者にお問い合わせください。')
          return
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) {
          setError(error.message)
        } else {
          setSuccess('確認メールを送信しました。メールのリンクをクリックして登録を完了してください。')
        }
      }
    } catch (submitError) {
      console.error('Login submit failed:', submitError)
      setError('ログイン処理中にエラーが発生しました。時間をおいて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex gap-0 mb-6 bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => setMode('login')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
          }`}
        >
          ログイン
        </button>
        <button
          onClick={() => setMode('signup')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
          }`}
        >
          新規登録
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}
        {callbackErrorMessage && !error && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
            {callbackErrorMessage}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
            {success}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            メールアドレス
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '...' : mode === 'login' ? 'ログイン' : '登録する'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            CreVis
          </Link>
          <p className="text-gray-500 mt-1 text-sm">成果の出るLPギャラリー</p>
        </div>

        <Suspense fallback={<div className="text-center text-gray-400">読み込み中...</div>}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-gray-400 mt-4">
          <Link href="/" className="hover:text-gray-600">
            ← ギャラリーに戻る
          </Link>
        </p>
      </div>
    </div>
  )
}
