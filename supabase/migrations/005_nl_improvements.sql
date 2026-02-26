ALTER TABLE nl_sources ADD COLUMN IF NOT EXISTS scrape_config jsonb;
ALTER TABLE nl_articles ADD COLUMN IF NOT EXISTS evidence_level text;
ALTER TABLE nl_articles ADD COLUMN IF NOT EXISTS actionable_tips jsonb;
ALTER TABLE nl_articles ADD COLUMN IF NOT EXISTS content_length int;
ALTER TABLE nl_articles ADD COLUMN IF NOT EXISTS extraction_method text;

CREATE INDEX IF NOT EXISTS nl_articles_auto_rejected_idx ON nl_articles(status) WHERE status = 'auto_rejected';
