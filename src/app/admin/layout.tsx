import { redirect } from 'next/navigation'
import { requireAdminAuth } from '@/lib/auth'
import { AdminSidebar } from './admin-sidebar'

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
    <div className="min-h-screen bg-[#f7f7f5]">
      <AdminSidebar />
      <main className="md:ml-56 p-4 sm:p-6">
        {children}
      </main>
    </div>
  )
}
