CREATE TABLE IF NOT EXISTS lp_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  source_type text NOT NULL,
  source_name text,
  discovered_at timestamptz DEFAULT now(),
  lp_confidence_score int,
  is_likely_lp boolean,
  page_title text,
  page_domain text,
  status text DEFAULT 'new',
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lp_candidates_status_idx ON lp_candidates(status);
CREATE INDEX IF NOT EXISTS lp_candidates_source_type_idx ON lp_candidates(source_type);
CREATE INDEX IF NOT EXISTS lp_candidates_confidence_idx ON lp_candidates(lp_confidence_score DESC);
CREATE INDEX IF NOT EXISTS lp_candidates_discovered_idx ON lp_candidates(discovered_at DESC);

ALTER TABLE lp_candidates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lp_collection_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  active boolean DEFAULT true,
  last_fetched_at timestamptz,
  total_collected int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lps ADD COLUMN IF NOT EXISTS lp_confidence_score int;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS is_likely_lp boolean DEFAULT true;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES lp_candidates(id);

CREATE TABLE IF NOT EXISTS lp_page_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lp_id uuid REFERENCES lps(id) ON DELETE CASCADE UNIQUE,
  h1_text text,
  h2_texts jsonb,
  meta_title text,
  meta_description text,
  main_copy_snippets jsonb,
  cta_buttons jsonb,
  total_sections int,
  page_height_ratio numeric,
  nav_link_count int,
  external_link_count int,
  internal_link_count int,
  form_field_count int,
  has_main_form boolean,
  has_social_proof boolean,
  has_testimonials boolean,
  has_faq boolean,
  has_pricing boolean,
  has_no_index boolean,
  has_video boolean,
  total_image_count int,
  page_load_time_ms int,
  analyzed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lp_page_features_lp_id_idx ON lp_page_features(lp_id);
ALTER TABLE lp_page_features ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lp_page_features' AND policyname = 'lp_page_features_select_all'
  ) THEN
    CREATE POLICY "lp_page_features_select_all" ON lp_page_features FOR SELECT USING (true);
  END IF;
END$$;

INSERT INTO lp_collection_sources (name, type, config, active)
SELECT * FROM (VALUES
  ('LPアーカイブ', 'gallery', '{"base_url":"https://rdlp.jp/lp-archive/","list_selector":".lp_archive_box","link_selector":"a"}'::jsonb, true),
  ('SANKOU!', 'gallery', '{"base_url":"https://sankoudesign.com/category/lp/","list_selector":"article","link_selector":"a"}'::jsonb, true),
  ('LP advance', 'gallery', '{"base_url":"https://site-advance.info/","list_selector":"article","link_selector":"a"}'::jsonb, true),
  ('Web Design Clip [L]', 'gallery', '{"base_url":"https://lp.webdesignclip.com/","list_selector":"article","link_selector":"a"}'::jsonb, true)
) AS seed(name, type, config, active)
WHERE NOT EXISTS (SELECT 1 FROM lp_collection_sources s WHERE s.name = seed.name);
