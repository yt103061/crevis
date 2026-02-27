-- 削除申請テーブル
CREATE TABLE IF NOT EXISTS takedown_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lp_id UUID NOT NULL REFERENCES lps(id) ON DELETE CASCADE,
  reason TEXT,                        -- 申請理由
  requester_email TEXT,               -- 申請者メール
  requester_name TEXT,                -- 申請者名（任意）
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,                    -- 管理者メモ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE takedown_requests ENABLE ROW LEVEL SECURITY;
-- 誰でもINSERT可（削除申請フォーム）
CREATE POLICY "Anyone can submit takedown" ON takedown_requests
  FOR INSERT WITH CHECK (true);
-- 管理者のみSELECT/UPDATE
CREATE POLICY "Admin can manage takedowns" ON takedown_requests
  FOR ALL USING (auth.role() = 'service_role');

-- インデックス
CREATE INDEX IF NOT EXISTS idx_takedown_requests_lp_id ON takedown_requests(lp_id);
CREATE INDEX IF NOT EXISTS idx_takedown_requests_status ON takedown_requests(status);
