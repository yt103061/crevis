-- LP候補テーブル
CREATE TABLE IF NOT EXISTS lp_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  source_type text NOT NULL,           -- 'gallery_scrape' | 'manual'
  source_name text,                    -- 'lp_archive' | 'sankou' | etc.
  discovered_at timestamptz DEFAULT now(),
  lp_confidence_score int,
  is_likely_lp boolean,
  page_title text,
  page_domain text,
  status text DEFAULT 'new',           -- 'new' | 'reviewed' | 'accepted' | 'rejected' | 'auto_accepted'
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lp_candidates_status_idx ON lp_candidates(status);
CREATE INDEX IF NOT EXISTS lp_candidates_source_type_idx ON lp_candidates(source_type);
CREATE INDEX IF NOT EXISTS lp_candidates_confidence_idx ON lp_candidates(lp_confidence_score DESC);
CREATE INDEX IF NOT EXISTS lp_candidates_discovered_idx ON lp_candidates(discovered_at DESC);

ALTER TABLE lp_candidates ENABLE ROW LEVEL SECURITY;

-- LP収集ソース定義テーブル
CREATE TABLE IF NOT EXISTS lp_collection_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,                  -- 'gallery' | 'google_query'
  config jsonb NOT NULL DEFAULT '{}',  -- gallery: {base_url, list_selector, link_selector, max_pages}
  active boolean DEFAULT true,
  last_fetched_at timestamptz,
  total_collected int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lp_collection_sources ENABLE ROW LEVEL SECURITY;

-- lpsテーブルにcandidate_idカラム追加（既にlp_confidence_score, is_likely_lpは004で追加済み）
ALTER TABLE lps ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES lp_candidates(id);

-- 初期収集ソースのシードデータ
INSERT INTO lp_collection_sources (name, type, config, active) VALUES
  (
    'LPアーカイブ',
    'gallery',
    '{
      "base_url": "https://rdlp.jp/lp-archive/",
      "list_selector": ".lp-list .lp-item",
      "link_selector": "a.lp-link",
      "max_pages": 3
    }',
    true
  ),
  (
    'SANKOU!',
    'gallery',
    '{
      "base_url": "https://sankoudesign.com/category/lp/",
      "list_selector": ".post-item",
      "link_selector": "a.btn-visit",
      "max_pages": 3
    }',
    true
  ),
  (
    'LP advance',
    'gallery',
    '{
      "base_url": "https://site-advance.info/",
      "list_selector": ".site-list .site-item",
      "link_selector": "a.visit-btn",
      "max_pages": 3
    }',
    true
  ),
  (
    'Web Design Clip [L]',
    'gallery',
    '{
      "base_url": "https://lp.webdesignclip.com/",
      "list_selector": ".clip-item",
      "link_selector": "a.external",
      "max_pages": 3
    }',
    true
  )
ON CONFLICT DO NOTHING;
