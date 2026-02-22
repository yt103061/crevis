-- nl_sourcesテーブルにcreated_atカラムを追加
ALTER TABLE nl_sources ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
