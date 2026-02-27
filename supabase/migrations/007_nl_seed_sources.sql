-- CRO系ニュースレターソースのプリセット
-- 既存レコードはスキップ（ON CONFLICT DO NOTHING）
INSERT INTO nl_sources (name, url, type, language, active) VALUES
  -- RSS対応CROブログ
  ('VWO Blog', 'https://vwo.com/blog/feed/', 'rss', 'en', true),
  ('Crazy Egg Blog', 'https://www.crazyegg.com/blog/feed/', 'rss', 'en', true),
  ('OptinMonster Blog', 'https://optinmonster.com/blog/feed/', 'rss', 'en', true),
  ('Instapage Blog', 'https://instapage.com/blog/feed', 'rss', 'en', true),
  ('Convert Blog', 'https://www.convert.com/blog/feed/', 'rss', 'en', true),
  ('Conversion Sciences', 'https://conversionsciences.com/feed/', 'rss', 'en', true),
  ('Omniconvert Blog', 'https://www.omniconvert.com/blog/feed/', 'rss', 'en', true),
  ('SiteTuners', 'https://sitetuners.com/feed/', 'rss', 'en', true),
  ('Unbounce Blog', 'https://unbounce.com/blog/feed/', 'rss', 'en', true),
  ('GetUplift Blog', 'https://getuplift.co/blog/feed/', 'rss', 'en', true),
  ('GuessTheTest', 'https://guessthetest.com/feed/', 'rss', 'en', true),
  -- Substack（CRO特化ニュースレター）
  ('Conversion Stash', 'https://conversionstash.substack.com/feed', 'rss', 'en', true),
  ('Experiment Nation', 'https://experimentnation.substack.com/feed', 'rss', 'en', true),
  ('Do What Works', 'https://dowhatworks.substack.com/feed', 'rss', 'en', true),
  -- スクレイピング（RSS非対応）
  ('CXL Blog', 'https://cxl.com/blog/', 'scrape', 'en', true),
  ('NNGroup Articles', 'https://www.nngroup.com/articles/', 'scrape', 'en', true),
  ('Baymard Institute', 'https://baymard.com/blog', 'scrape', 'en', true)
ON CONFLICT (url) DO NOTHING;

-- scrape設定を追加
UPDATE nl_sources
SET scrape_config = '{"list_url": "https://cxl.com/blog/", "article_selector": "article", "link_selector": "h2 a, h3 a", "max_pages": 2}'::jsonb
WHERE name = 'CXL Blog' AND scrape_config IS NULL;

UPDATE nl_sources
SET scrape_config = '{"list_url": "https://www.nngroup.com/articles/", "article_selector": ".article-card", "link_selector": "a[href]", "max_pages": 2}'::jsonb
WHERE name = 'NNGroup Articles' AND scrape_config IS NULL;

UPDATE nl_sources
SET scrape_config = '{"list_url": "https://baymard.com/blog", "article_selector": ".post", "link_selector": "a[href]", "max_pages": 2}'::jsonb
WHERE name = 'Baymard Institute' AND scrape_config IS NULL;
