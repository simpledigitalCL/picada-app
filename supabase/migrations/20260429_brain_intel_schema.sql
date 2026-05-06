-- Cerebro de inteligencia: catálogo, usuarios únicos por par, stats ampliadas.
-- Idempotente: seguro ejecutar si ya cargaste DDL manual parecido (ajusta sólo lo que falte).

create extension if not exists pgcrypto;

-- ─── tag_relations_stats ─────────────────────────────────────────────
create table if not exists public.tag_relations_stats (
  id uuid primary key default gen_random_uuid(),
  source_tag text not null,
  target_tag text not null,
  relation_type text not null,
  co_occurrence_count int not null default 1,
  last_updated timestamptz not null default now(),
  unique (source_tag, target_tag, relation_type)
);

alter table public.tag_relations_stats
  add column if not exists unique_users_count int not null default 0;

create index if not exists idx_tag_relations_source_type_count
  on public.tag_relations_stats (source_tag, relation_type, co_occurrence_count desc);

create index if not exists idx_tag_relations_smart
  on public.tag_relations_stats (source_tag, relation_type, unique_users_count desc, co_occurrence_count desc);

-- ─── Catálogo de etiquetas ────────────────────────────────────────────
create table if not exists public.tag_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  category text not null check (category in ('food', 'dress', 'ambience', 'local')),
  status text not null check (status in ('verified', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tag_catalog_category_status
  on public.tag_catalog (category, status);

-- ─── Desduplicación por usuario (contribuciones únicas por par) ───────
create table if not exists public.tag_relation_user_pair (
  source_tag text not null,
  target_tag text not null,
  relation_type text not null,
  user_id text not null,
  first_seen timestamptz not null default now(),
  primary key (source_tag, target_tag, relation_type, user_id)
);

create index if not exists idx_tag_relation_user_user on public.tag_relation_user_pair (user_id);

alter table public.tag_catalog enable row level security;
alter table public.tag_relation_user_pair enable row level security;

drop policy if exists "tag_catalog_read_all" on public.tag_catalog;
create policy "tag_catalog_read_all"
on public.tag_catalog for select
using (true);

drop policy if exists "tag_catalog_no_client_write" on public.tag_catalog;
create policy "tag_catalog_no_client_write"
on public.tag_catalog for all
using (false)
with check (false);

drop policy if exists "tag_relation_user_read_all" on public.tag_relation_user_pair;
create policy "tag_relation_user_read_all"
on public.tag_relation_user_pair for select
using (true);

drop policy if exists "tag_relation_user_no_client_write" on public.tag_relation_user_pair;
create policy "tag_relation_user_no_client_write"
on public.tag_relation_user_pair for all
using (false)
with check (false);
