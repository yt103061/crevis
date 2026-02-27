-- lpsテーブルにモバイルスクリーンショットURLカラムを追加
ALTER TABLE lps ADD COLUMN IF NOT EXISTS mobile_screenshot_url TEXT;

-- インデックス（screenshotフィルター用）
CREATE INDEX IF NOT EXISTS idx_lps_mobile_screenshot_url ON lps(mobile_screenshot_url) WHERE mobile_screenshot_url IS NULL;
