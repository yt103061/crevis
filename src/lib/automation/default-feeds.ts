export interface FeedSource {
  name: string
  url: string
}

export interface LPDiscoveryFeed {
  name: string
  url: string
  type: 'direct' | 'intermediary'
  market: 'jp' | 'global'
  weight: number
}

// 日本の運用実務で参照されやすい媒体（Web担当者Forum/MarkeZine等）と
// 海外一次情報（SEO/CRO系）を混在させる。
export const DEFAULT_NL_SOURCES: FeedSource[] = [
  { name: 'Web担当者Forum', url: 'https://webtan.impress.co.jp/rss.xml' },
  { name: 'MarkeZine', url: 'https://markezine.jp/rss/index.xml' },
  { name: 'LIGブログ', url: 'https://liginc.co.jp/feed' },
  { name: 'PR TIMES テクノロジー', url: 'https://prtimes.jp/technology/rss.xml' },
  { name: 'PR TIMES ネットサービス', url: 'https://prtimes.jp/internet/rss.xml' },
  { name: 'Search Engine Journal', url: 'https://www.searchenginejournal.com/feed/' },
  { name: 'Search Engine Land', url: 'https://searchengineland.com/feed' },
  { name: 'Ahrefs Blog', url: 'https://ahrefs.com/blog/feed/' },
  { name: 'HubSpot Marketing Blog', url: 'https://blog.hubspot.com/marketing/rss.xml' },
  { name: 'Moz Blog', url: 'https://moz.com/blog/feed' },
]

// LP候補の供給源。日本市場を優先し、PR記事など中間ページから外部LPを抽出するタイプも含める。
export const DEFAULT_LP_DISCOVERY_FEEDS: LPDiscoveryFeed[] = [
  {
    name: 'PR TIMES テクノロジー',
    url: 'https://prtimes.jp/technology/rss.xml',
    type: 'intermediary',
    market: 'jp',
    weight: 28,
  },
  {
    name: 'PR TIMES ネットサービス',
    url: 'https://prtimes.jp/internet/rss.xml',
    type: 'intermediary',
    market: 'jp',
    weight: 26,
  },
  {
    name: 'Product Hunt',
    url: 'https://www.producthunt.com/feed',
    type: 'direct',
    market: 'global',
    weight: 12,
  },
  {
    name: 'Indie Hackers Products',
    url: 'https://www.indiehackers.com/products.rss',
    type: 'direct',
    market: 'global',
    weight: 10,
  },
]
