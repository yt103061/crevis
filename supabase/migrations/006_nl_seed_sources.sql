INSERT INTO nl_sources (name, url, type, language, active)
SELECT * FROM (VALUES
('VWO Blog', 'https://vwo.com/blog/feed/', 'rss', 'en', true),
('Crazy Egg Blog', 'https://www.crazyegg.com/blog/feed/', 'rss', 'en', true),
('OptinMonster Blog', 'https://optinmonster.com/blog/feed/', 'rss', 'en', true),
('Instapage Blog', 'https://instapage.com/blog/feed', 'rss', 'en', true),
('Convert Blog', 'https://www.convert.com/blog/feed/', 'rss', 'en', true),
('Conversion Sciences', 'https://conversionsciences.com/feed/', 'rss', 'en', true),
('Convertize Blog', 'https://www.convertize.com/feed/', 'rss', 'en', true),
('Omniconvert Blog', 'https://www.omniconvert.com/blog/feed/', 'rss', 'en', true),
('SiteTuners', 'https://sitetuners.com/feed/', 'rss', 'en', true),
('Bryan Eisenberg', 'https://www.bryaneisenberg.com/feed/', 'rss', 'en', true),
('Unbounce Blog', 'https://unbounce.com/blog/feed/', 'rss', 'en', true),
('GetUplift Blog', 'https://getuplift.co/blog/feed/', 'rss', 'en', true),
('GuessTheTest', 'https://guessthetest.com/feed/', 'rss', 'en', true),
('Marketing Experiments', 'https://marketingexperiments.com/content/analysis/feed', 'rss', 'en', true),
('Conversion Stash', 'https://conversionstash.substack.com/feed', 'substack', 'en', true),
('Experiment Nation', 'https://experimentnation.substack.com/feed', 'substack', 'en', true),
('Do What Works', 'https://dowhatworks.substack.com/feed', 'substack', 'en', true),
('CXL Blog', 'https://cxl.com/blog/', 'scrape', 'en', true),
('NNGroup Articles', 'https://www.nngroup.com/articles/', 'scrape', 'en', true),
('Baymard Institute', 'https://baymard.com/blog', 'scrape', 'en', true)
) AS seed(name, url, type, language, active)
WHERE NOT EXISTS (SELECT 1 FROM nl_sources n WHERE n.name = seed.name);

UPDATE nl_sources SET scrape_config = '{"list_url": "https://cxl.com/blog/", "article_selector": "article", "link_selector": "a[href]", "max_pages": 2}'
WHERE name = 'CXL Blog';

UPDATE nl_sources SET scrape_config = '{"list_url": "https://www.nngroup.com/articles/", "article_selector": ".article-card", "link_selector": "a[href]", "max_pages": 2}'
WHERE name = 'NNGroup Articles';

UPDATE nl_sources SET scrape_config = '{"list_url": "https://baymard.com/blog", "article_selector": ".post", "link_selector": "a[href]", "max_pages": 2}'
WHERE name = 'Baymard Institute';
