'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_SECTIONS = [
  {
    items: [{ href: '/admin', label: 'ダッシュボード' }],
  },
  {
    title: 'LP管理',
    items: [
      { href: '/admin/lps', label: 'LP一覧' },
      { href: '/admin/lps/new', label: 'LP登録' },
      { href: '/admin/lp-candidates', label: 'LP候補' },
      { href: '/admin/lp-sources', label: 'LP収集ソース' },
    ],
  },
  {
    title: 'ニュースレター',
    items: [
      { href: '/admin/newsletter/sources', label: 'ソース管理' },
      { href: '/admin/newsletter/articles', label: '記事一覧' },
      { href: '/admin/newsletter/issues', label: '号管理' },
      { href: '/admin/newsletter/subscribers', label: '購読者' },
    ],
  },
  {
    items: [{ href: '/admin/settings', label: '設定' }],
  },
]

export function AdminSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Mobile header */}
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-bold text-indigo-600 text-lg">CreVis</span>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Admin</span>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 -mr-2 rounded-lg hover:bg-gray-100"
          aria-label="メニュー"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <Link href="/" className="flex items-center gap-2">
                <span className="font-bold text-indigo-600 text-lg">CreVis</span>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Admin</span>
              </Link>
            </div>
            <NavContent pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-56 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-10">
        <div className="p-4 border-b border-gray-200">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-indigo-600 text-lg">CreVis</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Admin</span>
          </Link>
        </div>
        <NavContent pathname={pathname} />
      </aside>
    </>
  )
}

function NavContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="p-2 space-y-1">
      {NAV_SECTIONS.map((section, i) => (
        <div key={i} className={i > 0 ? 'pt-2' : ''}>
          {section.title && (
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                pathname === item.href
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}
