-- lpsテーブルにLP判定スコアを追加
ALTER TABLE lps ADD COLUMN IF NOT EXISTS lp_confidence_score int;
ALTER TABLE lps ADD COLUMN IF NOT EXISTS is_likely_lp boolean DEFAULT true;

-- ページ構造データ保存テーブル
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

-- RLS
ALTER TABLE lp_page_features ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lp_page_features' AND policyname = 'lp_page_features_select_all'
  ) THEN
    CREATE POLICY "lp_page_features_select_all" ON lp_page_features FOR SELECT USING (true);
  END IF;
END
$$;
