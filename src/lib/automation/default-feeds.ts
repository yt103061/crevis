export interface FeedSource {
  name: string
  url: string
}

export const DEFAULT_NL_SOURCES: FeedSource[] = [
  { name: 'Search Engine Journal', url: 'https://www.searchenginejournal.com/feed/' },
  { name: 'Search Engine Land', url: 'https://searchengineland.com/feed' },
  { name: 'HubSpot Marketing Blog', url: 'https://blog.hubspot.com/marketing/rss.xml' },
  { name: 'Ahrefs Blog', url: 'https://ahrefs.com/blog/feed/' },
  { name: 'Think with Google', url: 'https://www.thinkwithgoogle.com/intl/en-apac/feed/' },
  { name: 'Web担当者Forum', url: 'https://webtan.impress.co.jp/rss.xml' },
  { name: 'MarkeZine', url: 'https://markezine.jp/rss/index.xml' },
  { name: 'LIGブログ', url: 'https://liginc.co.jp/feed' },
]

export const DEFAULT_LP_DISCOVERY_FEEDS: string[] = [
  'https://www.producthunt.com/feed',
  'https://www.indiehackers.com/products.rss',
  'https://www.kickstarter.com/discover/advanced?sort=newest&format=atom',
  'https://news.ycombinator.com/rss',
]
