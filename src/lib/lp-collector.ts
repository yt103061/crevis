import { createServiceClient } from '@/lib/supabase'
import { fetchExternal } from '@/lib/http-client'

export interface GallerySourceConfig {
  base_url: string
  list_selector: string
  link_selector: string
  pagination?: string
  max_pages?: number
}

export interface GoogleQueryConfig {
  query: string
  region: string
}

function normalizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function selectorToRegex(selector: string): RegExp {
  const normalized = selector.trim()
  if (normalized.startsWith('.')) {
    const cls = normalized.slice(1)
    return new RegExp(`<[^>]*class=["'][^"']*${cls}[^"']*["'][^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi')
  }
  if (normalized.startsWith('#')) {
    const id = normalized.slice(1)
    return new RegExp(`<[^>]*id=["']${id}["'][^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi')
  }
  return new RegExp(`<${normalized}[^>]*>[\\s\\S]*?<\\/${normalized}>`, 'gi')
}

function extractLinksFromHtml(html: string): string[] {
  return Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)).map((m) => m[1])
}

export async function collectFromGallery(config: GallerySourceConfig): Promise<string[]> {
  const supabase = createServiceClient({ requireServiceRole: true })
  const html = await (await fetchExternal(config.base_url)).text()
  const blocks = Array.from(html.matchAll(selectorToRegex(config.list_selector))).map((m) => m[0])
  const candidates = new Set<string>()

  for (const block of blocks.length ? blocks : [html]) {
    const links = extractLinksFromHtml(block)
    for (const link of links) {
      const normalized = normalizeUrl(new URL(link, config.base_url).toString())
      if (!normalized) continue
      if (normalized.includes('rdlp.jp') || normalized.includes('sankoudesign.com') || normalized.includes('webdesignclip.com') || normalized.includes('site-advance.info')) {
        continue
      }
      candidates.add(normalized)
    }
  }

  const urls = Array.from(candidates)
  const uniqueUrls: string[] = []
  for (const url of urls) {
    const { data: exists } = await supabase.from('lp_candidates').select('id').eq('url', url).single()
    if (!exists) uniqueUrls.push(url)
  }

  return uniqueUrls
}

export async function collectFromGoogleSearch(): Promise<string[]> {
  return []
}
