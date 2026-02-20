import { redirect } from 'next/navigation'
import { requireAdminAuth } from '@/lib/auth'
import Link from 'next/link'

export const metadata = {
  robots: 'noindex, nofollow',
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdminAuth()
  if (!session) {
    redirect('/login?redirect=/admin')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-10">
        <div className="p-4 border-b border-gray-200">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-indigo-600 text-lg">CreVis</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Admin</span>
          </Link>
        </div>
        <nav className="p-2 space-y-1">
          <NavLink href="/admin">ダッシュボード</NavLink>
          <div className="pt-2">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">LP管理</p>
            <NavLink href="/admin/lps">LP一覧</NavLink>
            <NavLink href="/admin/lps/new">LP登録</NavLink>
          </div>
          <div className="pt-2">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">ニュースレター</p>
            <NavLink href="/admin/newsletter/sources">ソース管理</NavLink>
            <NavLink href="/admin/newsletter/articles">記事一覧</NavLink>
            <NavLink href="/admin/newsletter/issues">号管理</NavLink>
            <NavLink href="/admin/newsletter/subscribers">購読者</NavLink>
          </div>
          <div className="pt-2">
            <NavLink href="/admin/settings">設定</NavLink>
          </div>
        </nav>
      </aside>
      {/* Main */}
      <main className="ml-56 flex-1 p-6">
        {children}
      </main>
    </div>
  )
}

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center px-3 py-2 text-sm rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      {children}
    </Link>
  )
}
