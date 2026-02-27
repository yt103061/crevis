-- LP発見元メタデータの追加
ALTER TABLE lps ADD COLUMN IF NOT EXISTS ad_first_seen_at TIMESTAMPTZ;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS ad_last_seen_at TIMESTAMPTZ;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS ad_days_active INTEGER;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS advertiser_id TEXT;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS ad_keywords TEXT[];
ALTER TABLE lps ADD COLUMN IF NOT EXISTS has_noindex BOOLEAN DEFAULT FALSE;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS discovery_source TEXT; -- 'rss'|'robots_txt'|'serpapi_search'|'serpapi_transparency'|'wayback_cdx'|'boxil'|'gallery_seed'

-- 発見ソース別インデックス
CREATE INDEX IF NOT EXISTS idx_lps_discovery_source ON lps(discovery_source);
CREATE INDEX IF NOT EXISTS idx_lps_advertiser_id ON lps(advertiser_id) WHERE advertiser_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lps_ad_days_active ON lps(ad_days_active) WHERE ad_days_active IS NOT NULL;
