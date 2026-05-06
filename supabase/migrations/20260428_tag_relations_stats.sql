create extension if not exists pgcrypto;

create table if not exists public.tag_relations_stats (
  id uuid primary key default gen_random_uuid(),
  source_tag text not null,
  target_tag text not null,
  relation_type text not null,
  co_occurrence_count int not null default 1,
  last_updated timestamptz not null default now(),
  unique (source_tag, target_tag, relation_type)
);

create index if not exists idx_tag_relations_source_type_count
  on public.tag_relations_stats (source_tag, relation_type, co_occurrence_count desc);

create index if not exists idx_tag_relations_last_updated
  on public.tag_relations_stats (last_updated desc);

alter table public.tag_relations_stats enable row level security;

create policy "tag_relations_read_all"
on public.tag_relations_stats for select
using (true);

create policy "tag_relations_no_client_write"
on public.tag_relations_stats for all
using (false)
with check (false);

