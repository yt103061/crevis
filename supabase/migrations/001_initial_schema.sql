-- Enable pgvector extension
create extension if not exists vector;

-- LPマスタ
create table lps (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text,
  industry text,
  purpose text,
  target_audience text,
  screenshot_url text,
  first_seen_at timestamptz default now(),
  last_checked_at timestamptz,
  ad_platform text,
  status text default 'active',
  created_at timestamptz default now()
);

-- AI分析結果
create table lp_analyses (
  id uuid primary key default gen_random_uuid(),
  lp_id uuid references lps(id) on delete cascade,
  structure_score int,
  copy_score int,
  trust_score int,
  longevity_score int,
  total_score int,
  good_points jsonb,
  improvement_points jsonb,
  why_it_works text,
  target_match text,
  embedding vector(1536),
  analyzed_at timestamptz default now()
);

-- ユーザーコレクション
create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  lp_id uuid references lps(id) on delete cascade,
  memo text,
  created_at timestamptz default now(),
  unique(user_id, lp_id)
);

-- NLソース定義
create table nl_sources (
  id uuid primary key default gen_random_uuid(),
  name text,
  url text,
  type text,
  language text default 'en',
  active boolean default true,
  last_fetched_at timestamptz
);

-- NL記事候補
create table nl_articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references nl_sources(id) on delete cascade,
  original_url text unique,
  original_title text,
  original_content text,
  summary_ja text,
  translated_title_ja text,
  key_insights jsonb,
  relevance_score int,
  status text default 'pending',
  fetched_at timestamptz default now()
);

-- NL号
create table newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  issue_number int unique,
  title text,
  content_html text,
  featured_lps jsonb,
  featured_articles jsonb,
  status text default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count int,
  created_at timestamptz default now()
);

-- NL購読者
create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  plan text default 'free',
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz
);

-- ユーザープロフィール
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);

-- RLS設定
alter table lps enable row level security;
alter table lp_analyses enable row level security;
alter table collections enable row level security;
alter table nl_sources enable row level security;
alter table nl_articles enable row level security;
alter table newsletter_issues enable row level security;
alter table newsletter_subscribers enable row level security;
alter table profiles enable row level security;

-- LPs: 全員読み取り可能
create policy "lps_select_all" on lps for select using (true);

-- lp_analyses: 全員読み取り可能
create policy "lp_analyses_select_all" on lp_analyses for select using (true);

-- collections: 自分のコレクションのみ操作可能
create policy "collections_select_own" on collections for select using (auth.uid() = user_id);
create policy "collections_insert_own" on collections for insert with check (auth.uid() = user_id);
create policy "collections_delete_own" on collections for delete using (auth.uid() = user_id);
create policy "collections_update_own" on collections for update using (auth.uid() = user_id);

-- profiles: 自分のプロフィールのみ操作可能
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- newsletter_issues: 全員読み取り可能（公開済みのみ）
create policy "newsletter_issues_select_sent" on newsletter_issues for select using (status = 'sent');

-- newsletter_subscribers: 本人のみ
create policy "newsletter_subscribers_select_own" on newsletter_subscribers for select using (email = (select email from auth.users where id = auth.uid()));

-- nl_sources, nl_articles: 管理者のみ（サービスロールキーで操作）
-- 一般ユーザーからは非アクセス

-- トリガー: プロフィール自動作成
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- インデックス
create index lps_status_idx on lps(status);
create index lps_industry_idx on lps(industry);
create index lps_created_at_idx on lps(created_at desc);
create index lp_analyses_lp_id_idx on lp_analyses(lp_id);
create index lp_analyses_total_score_idx on lp_analyses(total_score desc);
create index nl_articles_status_idx on nl_articles(status);
create index nl_articles_relevance_idx on nl_articles(relevance_score desc);
