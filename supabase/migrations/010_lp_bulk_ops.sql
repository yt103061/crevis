-- lps.status に 'inactive' 値を使えるようにする（既存カラムへの追記、値は制約なし）
ALTER TABLE lps ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_lps_status_v2 ON lps(status);

-- lp_candidates に url_hash など不足カラムを追加
ALTER TABLE lp_candidates ADD COLUMN IF NOT EXISTS url_hash TEXT;
ALTER TABLE lp_candidates ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE lp_candidates ADD COLUMN IF NOT EXISTS source_meta JSONB;
ALTER TABLE lp_candidates ADD COLUMN IF NOT EXISTS heuristic_score INTEGER;
ALTER TABLE lp_candidates ADD COLUMN IF NOT EXISTS ai_is_lp BOOLEAN;
ALTER TABLE lp_candidates ADD COLUMN IF NOT EXISTS ai_confidence REAL;
ALTER TABLE lp_candidates ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- url_hash に部分一意インデックス（既存行は NULL なので衝突しない）
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_url_hash
  ON lp_candidates(url_hash) WHERE url_hash IS NOT NULL;
