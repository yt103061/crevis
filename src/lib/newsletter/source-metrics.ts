import { createServiceClient } from '@/lib/supabase'

type SourceRow = { id: string; name: string; url: string; active: boolean }
type ArticleRow = { source_id: string; status: string; relevance_score: number | null }

export interface SourceQualityMetrics {
  source_id: string
  source_name: string
  source_url: string
  active: boolean
  total_articles: number
  approved: number
  rejected: number
  pending: number
  /** 承認率（0.0〜1.0）*/
  approval_rate: number
  /** 全記事の平均relevance_score（null = スコアなし記事のみ）*/
  avg_relevance_score: number | null
  /**
   * 品質ティア:
   * - high:    承認率60%以上 かつ 平均スコア70以上
   * - medium:  承認率30%以上 または 平均スコア50以上
   * - low:     それ以外（記事が5件以上ある場合）
   * - unknown: 記事が5件未満で統計的に判断不能
   */
  quality_tier: 'high' | 'medium' | 'low' | 'unknown'
}

/**
 * B1: ニュースレターソースごとの品質メトリクスを集計して返す。
 * 承認率・平均relevance_scoreにより quality_tier を算出する。
 * 管理画面でのソース評価・廃止判断に利用する。
 */
export async function getSourceQualityMetrics(): Promise<SourceQualityMetrics[]> {
  const supabase = createServiceClient({ requireServiceRole: true })

  const [{ data: sources, error: srcError }, { data: articles, error: artError }] =
    await Promise.all([
      supabase.from('nl_sources').select('id, name, url, active'),
      supabase.from('nl_articles').select('source_id, status, relevance_score'),
    ])

  if (srcError || !sources) return []

  const articleRows: ArticleRow[] = artError || !articles ? [] : (articles as ArticleRow[])

  const metrics: SourceQualityMetrics[] = (sources as SourceRow[]).map((source: SourceRow) => {
    const rows = articleRows.filter((a: ArticleRow) => a.source_id === source.id)
    const total = rows.length
    const approved = rows.filter((a: ArticleRow) => a.status === 'approved').length
    const rejected = rows.filter((a: ArticleRow) => a.status === 'rejected').length
    const pending = rows.filter((a: ArticleRow) => a.status === 'pending').length

    const scored = rows.filter((a: ArticleRow) => a.relevance_score != null)
    const avgScore =
      scored.length > 0
        ? Math.round(scored.reduce((s: number, a: ArticleRow) => s + (a.relevance_score ?? 0), 0) / scored.length)
        : null

    const approvalRate = total > 0 ? Math.round((approved / total) * 100) / 100 : 0

    let quality_tier: SourceQualityMetrics['quality_tier'] = 'unknown'
    if (total >= 5) {
      if (approvalRate >= 0.6 && (avgScore ?? 0) >= 70) {
        quality_tier = 'high'
      } else if (approvalRate >= 0.3 || (avgScore ?? 0) >= 50) {
        quality_tier = 'medium'
      } else {
        quality_tier = 'low'
      }
    }

    return {
      source_id: source.id,
      source_name: source.name,
      source_url: source.url,
      active: source.active,
      total_articles: total,
      approved,
      rejected,
      pending,
      approval_rate: approvalRate,
      avg_relevance_score: avgScore,
      quality_tier,
    }
  })

  // 品質ティア順 → 記事数降順でソート
  const tierOrder: Record<SourceQualityMetrics['quality_tier'], number> = {
    high: 0,
    medium: 1,
    low: 2,
    unknown: 3,
  }
  return metrics.sort((a, b) => {
    const t = tierOrder[a.quality_tier] - tierOrder[b.quality_tier]
    return t !== 0 ? t : b.total_articles - a.total_articles
  })
}
