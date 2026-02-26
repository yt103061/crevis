import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/auth'
import { collectFromGallery } from '@/lib/lp-collector'
import { analyzeLPPage } from '@/lib/lp-analyzer'

export async function POST() {
  const session = await requireAdminAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient({ requireServiceRole: true })
  const { data: sources, error } = await supabase.from('lp_collection_sources').select('*').eq('active', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let newCandidates = 0
  let autoAccepted = 0
  let rejected = 0

  for (const source of sources ?? []) {
    if (source.type !== 'gallery') continue
    try {
      const urls = await collectFromGallery(source.config)
      for (const url of urls) {
        try {
          const features = await analyzeLPPage(url)
          const baseBoost = source.type === 'gallery' ? 20 : 0
          const score = Math.min(100, features.lpConfidenceScore + baseBoost)
          const status = score >= 70 ? 'auto_accepted' : 'new'

          await supabase.from('lp_candidates').upsert({
            url,
            source_type: 'gallery_scrape',
            source_name: source.name,
            lp_confidence_score: score,
            is_likely_lp: score >= 40,
            page_title: features.metaTitle || null,
            page_domain: new URL(url).hostname,
            status,
          }, { onConflict: 'url' })

          newCandidates++
          if (status === 'auto_accepted') autoAccepted++
          if (score < 40) rejected++
        } catch (candidateError) {
          console.error('candidate analyze failed', candidateError)
        }
      }

      await supabase.from('lp_collection_sources').update({
        last_fetched_at: new Date().toISOString(),
        total_collected: (source.total_collected ?? 0) + urls.length,
      }).eq('id', source.id)
    } catch (sourceError) {
      console.error('source collect failed', sourceError)
    }
  }

  return NextResponse.json({ newCandidates, autoAccepted, rejected })
}
