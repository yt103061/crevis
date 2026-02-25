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

// CreVisの目的（CRO/LP改善の実証知見を日本語で届ける）に合わせ、
// 海外のCRO一次情報 + 日本の有力マーケ媒体を同梱する。
export const DEFAULT_NL_SOURCES: FeedSource[] = [
  // 海外CRO専門メディア（直接的な知見）
  { name: 'ConversionXL (CXL)', url: 'https://cxl.com/blog/feed/' },
  { name: 'Unbounce Blog', url: 'https://unbounce.com/blog/feed/' },
  { name: 'VWO Blog', url: 'https://vwo.com/blog/feed/' },
  { name: 'Hotjar Blog', url: 'https://www.hotjar.com/blog/feed/' },
  { name: 'Baymard Institute', url: 'https://baymard.com/blog.rss' },

  // 海外UX/マーケ（間接的知見）
  { name: 'Nielsen Norman Group', url: 'https://www.nngroup.com/feed/rss/' },
  { name: 'Search Engine Journal', url: 'https://www.searchenginejournal.com/feed/' },
  { name: 'Ahrefs Blog', url: 'https://ahrefs.com/blog/feed/' },
  { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/' },
  { name: 'UX Collective', url: 'https://uxdesign.cc/feed' },

  // 日本のCRO/LP・マーケ媒体
  { name: 'WACULテクノロジー&マーケティングラボ', url: 'https://wacul.co.jp/lab/feed/' },
  { name: 'Ptengineブログ', url: 'https://blog.ptengine.jp/feed/' },
  { name: 'Web担当者Forum', url: 'https://webtan.impress.co.jp/rss.xml' },
  { name: 'MarkeZine', url: 'https://markezine.jp/rss/index.xml' },
  { name: 'ferret（マーケティング）', url: 'https://ferret-plus.com/feed' },
  { name: 'DIGIDAY Japan', url: 'https://digiday.jp/feed/' },
  { name: 'LIGブログ', url: 'https://liginc.co.jp/feed' },
]

// LP候補は日本市場を優先。PR記事など中間ページから外部LPを抽出する。
export const DEFAULT_LP_DISCOVERY_FEEDS: LPDiscoveryFeed[] = [
  // 日本のプレスリリース（中間ページから外部LP URLを抽出）
  // PR TIMESのカテゴリ別RSSは存在しない。公式全件フィードのみ利用可能
  {
    name: 'PR TIMES',
    url: 'https://prtimes.jp/index.rdf',
    type: 'intermediary',
    market: 'jp',
    weight: 28,
  },
  // グローバル（中間ページから製品サイトURLを抽出）
  {
    name: 'Product Hunt',
    url: 'https://www.producthunt.com/feed',
    type: 'intermediary',
    market: 'global',
    weight: 22,
  },
  {
    name: 'Indie Hackers Products',
    url: 'https://www.indiehackers.com/products.rss',
    type: 'intermediary',
    market: 'global',
    weight: 20,
  },
  {
    name: 'Hacker News Show HN',
    url: 'https://hnrss.org/show',
    type: 'direct',
    market: 'global',
    weight: 14,
  },
]
