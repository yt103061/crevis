-- profiles.plan に CHECK 制約を追加（free / reader / pro / team のみ許可）
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'reader', 'pro', 'team'));

-- plan カラムのデフォルト値を明示
ALTER TABLE profiles
  ALTER COLUMN plan SET DEFAULT 'free';
