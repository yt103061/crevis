import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { fetchArticlesFromSources } from '@/lib/newsletter-automation'

export async function POST() {
  const session = await requireAdminAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await fetchArticlesFromSources(10)
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Fetch from sources failed:', error)
    return NextResponse.json({ error: 'No active sources found' }, { status: 400 })
  }
}
