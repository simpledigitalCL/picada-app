-- =============================================================================
-- PHASE 3.2 — Domain events persistence + ranking views
-- Idempotent migration for Supabase
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('CONTENT_CREATED', 'USER_VOTED', 'USER_REVIEWED', 'USER_SAVED', 'USER_VISITED', 'USER_SCANNED')),
  user_id text,
  username text,
  payload jsonb not null default '{}'::jsonb,
  event_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_domain_events_event_type on public.domain_events(event_type);
create index if not exists idx_domain_events_event_at on public.domain_events(event_at desc);
create index if not exists idx_domain_events_user_id on public.domain_events(user_id);
create index if not exists idx_domain_events_payload_gin on public.domain_events using gin(payload);
create index if not exists idx_posts_quality_score on public.posts (((coalesce((nutrition_data->>'quality_score')::int, 0)))) where nutrition_data is not null;

-- Public read, service-role writes from backend routes
alter table public.domain_events enable row level security;

create policy if not exists "domain_events_public_read"
on public.domain_events for select
using (true);

create policy if not exists "domain_events_no_client_write"
on public.domain_events for all
using (false)
with check (false);

create or replace view public.user_event_leaderboard as
select
  coalesce(nullif(de.user_id, ''), 'anon') as user_id,
  coalesce(max(nullif(de.username, '')), 'foodie') as username,
  count(*) filter (where de.event_type = 'USER_REVIEWED')::int as reviews_count,
  count(*) filter (where de.event_type = 'USER_VISITED')::int as visits_count,
  count(*) filter (where de.event_type = 'USER_VOTED' and coalesce((de.payload->>'voted')::boolean, true))::int as votes_count,
  sum(greatest(0, coalesce((de.payload->>'xp')::int, 0)))::int as total_xp,
  (
    sum(greatest(0, coalesce((de.payload->>'xp')::int, 0))) +
    count(*) filter (where de.event_type = 'USER_REVIEWED') * 25 +
    count(*) filter (where de.event_type = 'USER_VISITED') * 8 +
    count(*) filter (where de.event_type = 'USER_VOTED' and coalesce((de.payload->>'voted')::boolean, true)) * 4
  )::int as score
from public.domain_events de
group by coalesce(nullif(de.user_id, ''), 'anon')
order by score desc, total_xp desc;

create or replace view public.picada_event_ranking as
with votes as (
  select
    coalesce(nullif(de.payload->>'picadaId', ''), nullif(de.payload->>'placeId', ''), nullif(de.payload->>'placeName', ''), 'unknown') as picada_id,
    sum(
      case
        when de.event_type = 'USER_VOTED' and coalesce((de.payload->>'voted')::boolean, true) then 1
        when de.event_type = 'USER_VOTED' and coalesce((de.payload->>'voted')::boolean, true) = false then -1
        else 0
      end
    )::int as votes_net,
    count(*) filter (where de.event_type = 'USER_VISITED')::int as visits_count,
    count(*) filter (where de.event_type = 'USER_REVIEWED')::int as reviews_count
  from public.domain_events de
  where de.event_type in ('USER_VOTED', 'USER_VISITED', 'USER_REVIEWED')
  group by coalesce(nullif(de.payload->>'picadaId', ''), nullif(de.payload->>'placeId', ''), nullif(de.payload->>'placeName', ''), 'unknown')
)
select
  picada_id,
  greatest(0, votes_net) as community_votes,
  visits_count,
  reviews_count,
  (
    greatest(0, votes_net) * 9 +
    reviews_count * 6 +
    visits_count * 3
  )::int as ranking_score
from votes
where picada_id <> 'unknown'
order by ranking_score desc, community_votes desc;

