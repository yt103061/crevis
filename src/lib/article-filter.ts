/**
 * CRO/LP関連性による記事事前フィルター
 * AIを呼ぶ前に明らかに無関係な記事を除外する
 */

/** 高関連性キーワード（タイトルに含まれればAI処理対象） */
const HIGH_RELEVANCE_KEYWORDS = [
  // CRO直結
  'conversion', 'cvr', 'a/b test', 'a/b テスト', 'landing page', 'ランディングページ', 'lp',
  'cta', 'call to action', 'コールトゥアクション',
  'heatmap', 'ヒートマップ', 'clickmap', 'クリックマップ',
  'form optimization', 'フォーム最適化', 'checkout', 'チェックアウト',
  'user behavior', 'ユーザー行動', 'ux', 'user experience', 'ユーザー体験',
  'copywriting', 'コピーライティング', 'headline', 'ヘッドライン',
  'persuasion', '説得', 'neuromarketing', 'ニューロマーケティング',
  'social proof', 'ソーシャルプルーフ', 'testimonial', '口コミ', '導入事例',

  // マーケティング
  'marketing', 'マーケティング', 'funnel', 'ファネル', 'lead generation', 'リード獲得',
  'email marketing', 'メールマーケティング', 'personalization', 'パーソナライゼーション',
  'retention', 'リテンション', 'churn', 'チャーン', 'acquisition', '獲得',
  'roi', 'roas', 'cpa', 'cpc',

  // デザイン・UX
  'design', 'デザイン', 'ui', 'interface', 'インターフェース',
  'accessibility', 'アクセシビリティ', 'mobile', 'モバイル', 'responsive', 'レスポンシブ',
  'page speed', 'ページ速度', 'core web vitals', 'パフォーマンス',

  // AI・データ
  'ai marketing', 'ai マーケティング', 'machine learning', '機械学習',
  'analytics', 'アナリティクス', 'data-driven', 'データドリブン',
  'generative ai', '生成ai',
]

/** 除外キーワード（タイトルにあれば自動却下） */
const EXCLUDE_KEYWORDS = [
  // 政治・社会
  '選挙', '政治', '国会', '議員', '大統領', 'election', 'politics', 'congress', 'senate',
  '戦争', '紛争', '武力', 'war', 'military', 'conflict',

  // スポーツ・エンタメ
  'サッカー', '野球', 'バスケ', 'テニス', 'スポーツ', 'soccer', 'baseball', 'basketball',
  '映画', '音楽', 'アニメ', 'ゲーム', 'movie', 'music', 'entertainment',

  // 無関係技術
  'ブロックチェーン', '暗号通貨', 'nft', 'crypto', 'bitcoin', 'ethereum',
  'quantum', '量子', 'robotics', 'ロボット',

  // 一般ニュース
  '地震', '台風', '天気', '災害', 'earthquake', 'weather', 'disaster',
]

export interface FilterResult {
  pass: boolean
  reason: 'high_relevance' | 'no_match' | 'excluded'
  matchedKeyword?: string
}

/**
 * 記事タイトル・冒頭テキストでフィルタリングを行う
 * @returns pass=true の場合はAI処理対象
 */
export function filterArticle(title: string, content?: string): FilterResult {
  const combined = `${title} ${content?.slice(0, 500) ?? ''}`.toLowerCase()

  // 除外キーワードに一致 → 自動却下
  for (const kw of EXCLUDE_KEYWORDS) {
    if (combined.includes(kw.toLowerCase())) {
      return { pass: false, reason: 'excluded', matchedKeyword: kw }
    }
  }

  // 高関連性キーワードに一致 → AI処理対象
  for (const kw of HIGH_RELEVANCE_KEYWORDS) {
    if (combined.includes(kw.toLowerCase())) {
      return { pass: true, reason: 'high_relevance', matchedKeyword: kw }
    }
  }

  // どちらにも一致しない → スコアが不明なのでAIに渡す（ただしスキップ候補）
  return { pass: true, reason: 'no_match' }
}

/**
 * 関連性スコアの閾値（この値未満はDB保存するが auto_rejected扱い）
 */
export const AUTO_REJECT_SCORE_THRESHOLD = 30
