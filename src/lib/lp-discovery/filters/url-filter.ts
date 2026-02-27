/**
 * URLが「LPである可能性が高い」かどうかを判定するフィルター
 * 非LP（SNS・ニュース・ECモール等）を事前除外する
 */

const BLOCKED_DOMAINS = new Set([
  'x.com', 'twitter.com', 'facebook.com', 'instagram.com',
  'reddit.com', 'youtube.com', 'tiktok.com', 'line.me',
  'news.yahoo.co.jp', 'prtimes.jp', 'note.com', 'qiita.com', 'zenn.dev',
  'wikipedia.org',
  'amazon.co.jp', 'rakuten.co.jp',
  'github.com', 'linkedin.com',
])

const BLOCKED_PATH_PATTERNS = [
  /\/news\//i, /\/blog\//i, /\/article\//i, /\/articles\//i,
  /\/wiki\//i, /\/about\/us/i, /\/company\/profile/i,
  /\/recruit\//i, /\/careers\//i, /\/press\//i,
  /\/ir\//i, /\/investor/i, /\/privacy/i, /\/terms/i,
  /\/item\//i, // Rakuten商品ページ
  /\/dp\//i,   // Amazon商品ページ
]

const BLOCKED_EXTENSIONS = new Set([
  '.pdf', '.zip', '.mp4', '.mp3', '.png', '.jpg', '.jpeg',
  '.gif', '.svg', '.webp', '.xlsx', '.docx',
])

export function isLikelyLP(url: string): { pass: boolean; reason?: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { pass: false, reason: 'Invalid URL' }
  }

  const hostname = parsed.hostname.replace(/^www\./, '')
  const pathname = parsed.pathname.toLowerCase()

  // ファイル直リンク
  const ext = pathname.match(/\.[a-z0-9]{2,5}$/i)?.[0]?.toLowerCase()
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return { pass: false, reason: `File extension: ${ext}` }
  }

  // ブロックドメイン
  if (BLOCKED_DOMAINS.has(hostname)) {
    return { pass: false, reason: `Blocked domain: ${hostname}` }
  }

  // ブロックパス
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(pathname)) {
      return { pass: false, reason: `Blocked path pattern: ${pattern}` }
    }
  }

  // PR TIMESの記事ページ（prtimes.jp/main/html/rd/）はブロック
  if (hostname.includes('prtimes.jp') && pathname.includes('/rd/')) {
    return { pass: false, reason: 'PR TIMES article page' }
  }

  return { pass: true }
}
