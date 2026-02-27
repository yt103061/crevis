'use client'

import { useState } from 'react'

interface Props {
  lpId: string
}

export function TakedownButton({ lpId }: Props) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [reason, setReason] = useState('')
  const [email, setEmail] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/lps/${lpId}/takedown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, email }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        const data = await res.json()
        alert(data.error ?? '申請に失敗しました')
      }
    } catch {
      alert('通信エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <p className="text-xs text-emerald-600 text-center">削除申請を受け付けました。確認後、対応いたします。</p>
  }

  return (
    <div className="text-center">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-[#8a8f88] hover:text-[#5e625c] transition-colors"
        >
          このLPの削除を申請する
        </button>
      ) : (
        <form onSubmit={submit} className="text-left space-y-3 mt-2 p-4 bg-[#f7f7f5] rounded-xl border border-[#e3e5e0]">
          <p className="text-xs font-medium text-[#323632]">削除申請フォーム</p>
          <div>
            <label className="text-[10px] text-[#767b74] block mb-1">申請理由 <span className="text-rose-500">*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              placeholder="削除を希望する理由をご記入ください（権利侵害、掲載停止希望など）"
              className="w-full text-xs border border-[#d9dbd6] rounded-lg px-3 py-2 focus:outline-none focus:border-[#111111] resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#767b74] block mb-1">連絡先メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full text-xs border border-[#d9dbd6] rounded-lg px-3 py-2 focus:outline-none focus:border-[#111111]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !reason}
              className="flex-1 px-3 py-2 bg-[#111111] text-white text-xs font-medium rounded-lg disabled:opacity-50"
            >
              {submitting ? '送信中...' : '申請する'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-xs text-[#767b74] border border-[#d9dbd6] rounded-lg hover:bg-[#f1f1ee]"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
