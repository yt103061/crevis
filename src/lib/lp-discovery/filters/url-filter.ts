/**
 * URLが「LPである可能性が高い」かどうかを判定するフィルター
 * 非LP（SNS・ニュース・ECモール等）を事前除外する
 */

const BLOCKED_DOMAINS = new Set([
  // SNS
  'x.com', 'twitter.com', 'facebook.com', 'instagram.com',
  'reddit.com', 'youtube.com', 'tiktok.com', 'line.me',
  'pinterest.com', 'snapchat.com', 'threads.net',
  // ブログ・記事プラットフォーム
  'note.com', 'qiita.com', 'zenn.dev', 'medium.com', 'substack.com',
  'hatena.ne.jp', 'livedoor.jp', 'ameblo.jp',
  // ニュース・メディア
  'news.yahoo.co.jp', 'nikkei.com', 'asahi.com', 'yomiuri.co.jp',
  'mainichi.jp', 'sankei.com', 'nhk.or.jp', 'itmedia.co.jp',
  'cnet.com', 'techcrunch.com', 'engadget.com', 'wired.com',
  'prtimes.jp',
  // 参考・百科事典
  'wikipedia.org', 'wikia.com',
  // ECモール
  'amazon.co.jp', 'amazon.com', 'rakuten.co.jp',
  'yahoo.co.jp', 'mercari.com', 'fril.jp',
  'tokyu-dept.co.jp', 'lohaco.jp', 'au-pay-market.au.com',
  // 開発者・ドキュメント
  'github.com', 'gitlab.com', 'bitbucket.org',
  'stackoverflow.com', 'qiita.com',
  'docs.google.com', 'sheets.google.com', 'slides.google.com', 'forms.gle',
  'notion.so', 'confluence.atlassian.com',
  // SNS・ビジネス
  'linkedin.com', 'wantedly.com',
  // 求人
  'indeed.com', 'rikunabi.com', 'mynavi.jp', 'doda.jp',
  'en-japan.com', 'type.jp',
  // レビュー
  'tabelog.com', 'cookpad.com', 'yelp.com', 'tripadvisor.jp',
  // App Store系
  'apps.apple.com', 'play.google.com',
  // SaaS管理UI
  'app.hubspot.com', 'app.salesforce.com',
])

const BLOCKED_PATH_PATTERNS = [
  // コンテンツ系
  /\/news\//i, /\/blog\//i, /\/article\//i, /\/articles\//i,
  /\/wiki\//i, /\/topics\//i, /\/media\//i, /\/column\//i,
  /\/tag\//i, /\/tags\//i, /\/category\//i, /\/categories\//i,
  /\/author\//i, /\/authors\//i,
  // 企業情報
  /\/about\/us/i, /\/company\/profile/i, /\/corporate\//i,
  /\/recruit\//i, /\/careers\//i, /\/jobs\//i, /\/join\//i,
  /\/press\//i, /\/ir\//i, /\/investor/i,
  // 法務
  /\/privacy/i, /\/terms/i, /\/legal/i, /\/cookie/i,
  // EC商品ページ
  /\/item\//i, /\/dp\//i, /\/gp\/product\//i,
  // 開発系パス
  /\/issues\//i, /\/pull\//i, /\/commit\//i, /\/tree\//i,
  /\/blob\//i, /\/wiki\//i,
  // その他
  /\/search\?/i, /\/sitemap/i, /\/help\//i, /\/support\//i,
  /\/changelog/i, /\/status\//i,
  /\/viewform/i,  // Google Forms
]

const BLOCKED_EXTENSIONS = new Set([
  '.pdf', '.zip', '.tar', '.gz',
  '.mp4', '.mp3', '.wav', '.ogg',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.xlsx', '.docx', '.pptx', '.csv',
  '.exe', '.dmg', '.apk',
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

  // ブロックドメイン（完全一致 + サブドメイン）
  if (BLOCKED_DOMAINS.has(hostname)) {
    return { pass: false, reason: `Blocked domain: ${hostname}` }
  }
  // サブドメインもチェック（例: docs.github.com → github.com）
  const domainParts = hostname.split('.')
  if (domainParts.length > 2) {
    const rootDomain = domainParts.slice(-2).join('.')
    if (BLOCKED_DOMAINS.has(rootDomain)) {
      return { pass: false, reason: `Blocked root domain: ${rootDomain}` }
    }
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
