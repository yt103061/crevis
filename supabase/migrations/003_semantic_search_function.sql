-- 意味検索用のマッチング関数
create or replace function match_lps(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  url text,
  title text,
  industry text,
  purpose text,
  target_audience text,
  screenshot_url text,
  status text,
  created_at timestamptz,
  total_score int,
  structure_score int,
  copy_score int,
  trust_score int,
  longevity_score int,
  similarity float
)
language sql stable
as $$
  select
    lps.id,
    lps.url,
    lps.title,
    lps.industry,
    lps.purpose,
    lps.target_audience,
    lps.screenshot_url,
    lps.status,
    lps.created_at,
    la.total_score,
    la.structure_score,
    la.copy_score,
    la.trust_score,
    la.longevity_score,
    1 - (la.embedding <=> query_embedding) as similarity
  from lp_analyses la
  join lps on lps.id = la.lp_id
  where lps.status = 'active'
    and la.embedding is not null
    and 1 - (la.embedding <=> query_embedding) > match_threshold
  order by la.embedding <=> query_embedding
  limit match_count;
$$;
