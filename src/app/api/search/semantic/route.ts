import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embedding'

export async function POST(request: NextRequest) {
  const { query, limit = 10 } = await request.json()

  if (!query?.trim()) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  try {
    const embedding = await generateEmbedding(query)
    const supabase = createServiceClient()

    const { data, error } = await supabase.rpc('match_lps', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: limit,
    })

    if (error) {
      console.error('Semantic search error:', error)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    return NextResponse.json({ results: data ?? [] })
  } catch (err) {
    console.error('Embedding error:', err)
    return NextResponse.json({ error: 'Embedding generation failed' }, { status: 500 })
  }
}
