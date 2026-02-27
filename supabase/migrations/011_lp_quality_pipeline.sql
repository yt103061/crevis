-- lps テーブルに品質スコアカラムを追加
ALTER TABLE lps ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS lp_purpose TEXT;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS design_taste TEXT;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS url_hash TEXT;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS longevity_score INTEGER;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS cro_score INTEGER;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS effectiveness_score INTEGER;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS effectiveness_grade TEXT;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS longevity_checked_at TIMESTAMPTZ;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS cro_checked_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lps_url_hash
  ON lps(url_hash) WHERE url_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lps_effectiveness
  ON lps(effectiveness_score DESC) WHERE effectiveness_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lps_grade
  ON lps(effectiveness_grade) WHERE effectiveness_grade IS NOT NULL;

-- lp_candidates に status 'pending' インデックス追加
CREATE INDEX IF NOT EXISTS idx_candidates_status_v2 ON lp_candidates(status);
