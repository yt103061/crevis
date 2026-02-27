-- LP閲覧数追跡テーブル
-- PRIMARY KEY (user_id, lp_id) でユーザー×LP の組み合わせを一意に管理
-- viewed_at = 初回閲覧時刻。月次カウントは viewed_at >= 当月1日 で計算
CREATE TABLE IF NOT EXISTS lp_view_counts (
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lp_id    UUID NOT NULL REFERENCES lps(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lp_id)
);

ALTER TABLE lp_view_counts ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の閲覧記録のみ参照可能
CREATE POLICY "view_counts_select_own" ON lp_view_counts
  FOR SELECT USING (auth.uid() = user_id);

-- ユーザーは自分の閲覧記録のみ追加可能
CREATE POLICY "view_counts_insert_own" ON lp_view_counts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 月次集計用インデックス
CREATE INDEX IF NOT EXISTS lp_view_counts_user_month_idx
  ON lp_view_counts (user_id, viewed_at);
