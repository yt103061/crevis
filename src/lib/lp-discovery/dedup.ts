import { createHash } from 'crypto'
import type { createServiceClient } from '@/lib/supabase'

type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * URLを正規化する（追跡パラメータ除去・末尾スラッシュ統一・www除去）
 */
export function normalizeUrl(rawUrl: string): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return rawUrl
  }

  // https に統一
  url.protocol = 'https:'

  // www. 除去
  url.hostname = url.hostname.replace(/^www\./, '')

  // 追跡パラメータ除去
  const TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'fbclid', 'ref', 'source', 'mc_eid', 'mc_cid',
  ]
  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param)
  }

  // 末尾スラッシュを統一（パスが / のみの場合はそのまま）
  if (url.pathname !== '/') {
    url.pathname = url.pathname.replace(/\/$/, '')
  }

  return url.toString()
}

/**
 * 正規化済みURLのSHA-256ハッシュを返す
 */
export function hashUrl(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl).digest('hex')
}

/**
 * lps・lp_candidates テーブルと照合して重複チェック
 */
export async function isDuplicate(url: string, supabase: ServiceClient): Promise<boolean> {
  const normalized = normalizeUrl(url)

  // lps テーブルを確認
  const { data: lp } = await supabase
    .from('lps')
    .select('id')
    .eq('url', normalized)
    .limit(1)
  if (lp && lp.length > 0) return true

  // lp_candidates テーブルを確認
  const { data: candidate } = await supabase
    .from('lp_candidates')
    .select('id')
    .eq('url', normalized)
    .limit(1)
  if (candidate && candidate.length > 0) return true

  return false
}
