-- =============================================================================
-- Centralized analytics table for unified form submissions
-- One row per submit action from review/media/incognito/new-picada
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.content_submissions (
  id uuid primary key default gen_random_uuid(),

  -- Actor
  user_id text,
  username text,

  -- Form source and final content type
  entry_type text not null check (entry_type in ('review', 'media', 'incognito', 'new-picada')),
  content_type text not null check (content_type in ('review', 'photo', 'video', 'incognito', 'tip')),

  -- Content signals
  is_incognito boolean not null default false,
  has_media boolean not null default false,
  media_kind text check (media_kind in ('photo', 'video')),
  has_comment boolean not null default false,
  comment_length int not null default 0,
  rating int check (rating between 1 and 5),

  -- Place dimensions (optional)
  place_id text,
  place_name text,
  place_address text,

  -- Taxonomy (normalized)
  category text,
  tags text[] not null default '{}',
  moods text[] not null default '{}',

  -- Computed quality metrics
  quality_score int not null default 0,
  engagement_score int not null default 0,
  completeness int not null default 0,

  -- Raw and computed snapshots for reproducibility
  payload jsonb not null default '{}'::jsonb,
  computed jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_content_submissions_created_at on public.content_submissions(created_at desc);
create index if not exists idx_content_submissions_user_id on public.content_submissions(user_id);
create index if not exists idx_content_submissions_entry_type on public.content_submissions(entry_type);
create index if not exists idx_content_submissions_content_type on public.content_submissions(content_type);
create index if not exists idx_content_submissions_place_name on public.content_submissions(place_name);
create index if not exists idx_content_submissions_tags_gin on public.content_submissions using gin(tags);
create index if not exists idx_content_submissions_payload_gin on public.content_submissions using gin(payload);

alter table public.content_submissions enable row level security;

-- Read-only for authenticated clients (or adjust to your BI strategy)
drop policy if exists "content_submissions_read_authenticated" on public.content_submissions;
create policy "content_submissions_read_authenticated"
on public.content_submissions for select
using (auth.role() = 'authenticated');

-- No direct client writes (backend/service role only)
drop policy if exists "content_submissions_no_client_write" on public.content_submissions;
create policy "content_submissions_no_client_write"
on public.content_submissions for all
using (false)
with check (false);
