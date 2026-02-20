'use client'

import { useState } from 'react'

export function SubscribeForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')

    const res = await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await res.json()

    if (res.ok) {
      setStatus('success')
      setMessage(data.message)
      setEmail('')
    } else {
      setStatus('error')
      setMessage(data.error)
    }
  }

  if (status === 'success') {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
        {message}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
      >
        {status === 'loading' ? '...' : '購読する'}
      </button>
      {status === 'error' && (
        <p className="text-xs text-red-500 mt-1">{message}</p>
      )}
    </form>
  )
}
