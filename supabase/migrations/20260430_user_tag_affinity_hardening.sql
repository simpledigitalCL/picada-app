create table if not exists public.user_tag_affinity (
  user_id uuid not null,
  tag_slug text not null,
  weight integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, tag_slug)
);

alter table public.user_tag_affinity
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_user_tag_affinity_user_tag
  on public.user_tag_affinity(user_id, tag_slug);

create index if not exists idx_user_tag_affinity_updated_at
  on public.user_tag_affinity(updated_at desc);

