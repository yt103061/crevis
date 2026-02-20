export type LPStatus = 'active' | 'archived' | 'takedown'

export interface LP {
  id: string
  url: string
  title: string | null
  industry: string | null
  purpose: string | null
  target_audience: string | null
  screenshot_url: string | null
  first_seen_at: string
  last_checked_at: string | null
  ad_platform: string | null
  status: LPStatus
  created_at: string
}

export interface LPAnalysis {
  id: string
  lp_id: string
  structure_score: number
  copy_score: number
  trust_score: number
  longevity_score: number
  total_score: number
  good_points: string[]
  improvement_points: string[]
  why_it_works: string
  target_match: string
  analyzed_at: string
}

export interface LPWithAnalysis extends LP {
  lp_analyses: LPAnalysis[]
}

export interface Collection {
  id: string
  user_id: string
  lp_id: string
  memo: string | null
  created_at: string
}

export interface NLSource {
  id: string
  name: string
  url: string
  type: string
  language: string
  active: boolean
  last_fetched_at: string | null
}

export interface NLArticle {
  id: string
  source_id: string
  original_url: string
  original_title: string
  original_content: string | null
  summary_ja: string | null
  translated_title_ja: string | null
  key_insights: string[] | null
  relevance_score: number | null
  status: 'pending' | 'approved' | 'rejected'
  fetched_at: string
}

export interface NewsletterIssue {
  id: string
  issue_number: number
  title: string
  content_html: string | null
  featured_lps: string[] | null
  featured_articles: string[] | null
  status: 'draft' | 'ready' | 'sent'
  scheduled_at: string | null
  sent_at: string | null
  recipient_count: number | null
  created_at: string
}

export interface NewsletterSubscriber {
  id: string
  email: string
  plan: 'free' | 'pro' | 'team'
  subscribed_at: string
  unsubscribed_at: string | null
}

export interface Profile {
  id: string
  email: string | null
  plan: 'free' | 'pro' | 'team'
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
}

export interface LPAnalysisInput {
  url: string
  industry: string
  purpose: string
  target_audience: string
  days_active: number
}

export interface LPAnalysisOutput {
  structure_score: number
  copy_score: number
  trust_score: number
  longevity_score: number
  total_score: number
  good_points: string[]
  improvement_points: string[]
  why_it_works: string
  target_match: string
}

export interface ArticleInput {
  original_title: string
  original_content: string
}

export interface ArticleOutput {
  translated_title_ja: string
  summary_ja: string
  key_insights: string[]
  relevance_score: number
}
