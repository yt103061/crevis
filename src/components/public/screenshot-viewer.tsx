'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  desktopUrl: string | null
  mobileUrl: string | null
  title: string
}

export function ScreenshotViewer({ desktopUrl, mobileUrl, title }: Props) {
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop')
  const hasBoth = desktopUrl && mobileUrl

  return (
    <div>
      {hasBoth && (
        <div className="flex gap-1 p-3 border-b border-[#e3e5e0]">
          <button
            onClick={() => setView('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === 'desktop'
                ? 'bg-[#111111] text-white'
                : 'text-[#767b74] hover:bg-[#f1f1ee]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            デスクトップ
          </button>
          <button
            onClick={() => setView('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === 'mobile'
                ? 'bg-[#111111] text-white'
                : 'text-[#767b74] hover:bg-[#f1f1ee]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            モバイル
          </button>
        </div>
      )}

      <div className={view === 'mobile' ? 'flex justify-center bg-[#f1f1ee] py-6' : ''}>
        {view === 'desktop' && desktopUrl && (
          <div className="relative max-w-[800px] mx-auto w-full">
            <Image
              src={desktopUrl}
              alt={title}
              width={1280}
              height={900}
              className="w-full h-auto"
              priority
              placeholder="blur"
              blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            />
          </div>
        )}
        {view === 'mobile' && mobileUrl && (
          <div className="relative w-[280px] rounded-[2rem] overflow-hidden border-4 border-[#d9dbd6] shadow-xl">
            <Image
              src={mobileUrl}
              alt={`${title} (モバイル)`}
              width={750}
              height={1624}
              className="w-full h-auto"
              priority
            />
          </div>
        )}
        {/* どちらのURLもない場合 */}
        {!desktopUrl && !mobileUrl && (
          <div className="aspect-[16/9] flex flex-col items-center justify-center gap-3 bg-[#f1f1ee]">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shimmer">
              <svg className="w-8 h-8 text-[#8a8f88]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs text-[#767b74]">スクリーンショット取得中...</span>
          </div>
        )}
      </div>
    </div>
  )
}
