export interface ArticleFilterResult {
  isRelevant: boolean
  matchedKeywords: string[]
  confidence: 'high' | 'medium' | 'low'
}

const RELEVANT_KEYWORDS = [
  'landing page', 'conversion rate', 'cro', 'a/b test', 'split test',
  'call to action', 'cta', 'ux design', 'user experience', 'copywriting',
  'headline', 'above the fold', 'bounce rate', 'click-through rate',
  'form optimization', 'lead generation', 'sales page', 'funnel',
  'heatmap', 'eye tracking', 'usability', 'persuasion', 'social proof',
  'testimonial', 'trust signal', 'value proposition', 'hero section',
  'page speed', 'mobile optimization', 'responsive design',
  'experimentation', 'personalization', 'multivariate test',
  'ランディングページ', 'コンバージョン', 'cvr', 'abテスト',
  'uxデザイン', 'コピーライティング', 'ファーストビュー', 'ヒートマップ',
]

const NEGATIVE_KEYWORDS = [
  'cryptocurrency', 'blockchain', 'nft', 'stock market', 'recipe',
  'travel guide', 'celebrity gossip', 'sports score', 'horoscope',
]

export function filterArticle(title: string, content: string): ArticleFilterResult {
  const target = `${title} ${content.slice(0, 1000)}`.toLowerCase()
  const matchedKeywords = RELEVANT_KEYWORDS.filter((kw) => target.includes(kw.toLowerCase()))
  const negatives = NEGATIVE_KEYWORDS.filter((kw) => target.includes(kw))
  const adjustedScore = Math.max(0, matchedKeywords.length - negatives.length)

  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (adjustedScore >= 3) confidence = 'high'
  else if (adjustedScore >= 1) confidence = 'medium'

  return {
    isRelevant: confidence !== 'low',
    matchedKeywords,
    confidence,
  }
}
