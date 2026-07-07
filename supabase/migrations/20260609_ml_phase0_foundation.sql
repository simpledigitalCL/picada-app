-- =============================================================================
-- FASE 0 ML — Fundamentos de captura de datos para recomendaciones
--
-- user_interactions : log canónico append-only de interacciones usuario↔lugar
--                     (incluye impresiones). Nunca se agrega destructivamente;
--                     es la fuente para features y entrenamiento futuro.
-- user_preferences  : preferencias explícitas (likes/dislikes/restricciones)
--                     sincronizadas desde localStorage al iniciar sesión.
-- identity_links    : vínculo id anónimo de localStorage ↔ auth UUID, para
--                     recuperar historial previo al login (stitching).
-- place_tags        : materialización relacional de places.tagging_meta
--                     (automated_seed), mantenida por trigger.
--
-- Idempotente.
-- =============================================================================

create extension if not exists pgcrypto;

-- ─── user_interactions ───────────────────────────────────────────────────────

create table if not exists public.user_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  anon_id text,
  place_id uuid references public.places(id) on delete set null,
  place_external_id text,
  interaction_type text not null check (interaction_type in (
    'impression', 'card_click', 'detail_view', 'save', 'unsave', 'like',
    'review', 'visit', 'share', 'maps_click', 'search_click', 'scan'
  )),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_interactions_has_identity check (user_id is not null or anon_id is not null)
);

create index if not exists idx_user_interactions_user_time
  on public.user_interactions (user_id, created_at desc);

create index if not exists idx_user_interactions_anon
  on public.user_interactions (anon_id) where anon_id is not null;

create index if not exists idx_user_interactions_place
  on public.user_interactions (place_id) where place_id is not null;

create index if not exists idx_user_interactions_type_time
  on public.user_interactions (interaction_type, created_at desc);

alter table public.user_interactions enable row level security;

-- Lectura solo del propio historial; escrituras únicamente vía service role.
drop policy if exists "user_interactions_read_own" on public.user_interactions;
create policy "user_interactions_read_own"
on public.user_interactions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_interactions_no_client_write" on public.user_interactions;
create policy "user_interactions_no_client_write"
on public.user_interactions for insert
to authenticated, anon
with check (false);

-- ─── user_preferences ────────────────────────────────────────────────────────

create table if not exists public.user_preferences (
  user_id uuid primary key,
  likes text[] not null default '{}',
  dislikes text[] not null default '{}',
  restrictions text[] not null default '{}',
  religion text,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_read_own" on public.user_preferences;
create policy "user_preferences_read_own"
on public.user_preferences for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own"
on public.user_preferences for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
on public.user_preferences for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ─── identity_links ──────────────────────────────────────────────────────────

create table if not exists public.identity_links (
  anon_id text not null,
  user_id uuid not null,
  linked_at timestamptz not null default now(),
  primary key (anon_id, user_id)
);

create index if not exists idx_identity_links_user on public.identity_links (user_id);

alter table public.identity_links enable row level security;

drop policy if exists "identity_links_read_own" on public.identity_links;
create policy "identity_links_read_own"
on public.identity_links for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "identity_links_insert_own" on public.identity_links;
create policy "identity_links_insert_own"
on public.identity_links for insert
to authenticated
with check (auth.uid() = user_id);

-- ─── place_tags ──────────────────────────────────────────────────────────────

create table if not exists public.place_tags (
  place_id uuid not null references public.places(id) on delete cascade,
  tag_slug text not null,
  confidence numeric not null default 0.5,
  source text not null default 'automated_seed',
  updated_at timestamptz not null default now(),
  primary key (place_id, tag_slug, source)
);

create index if not exists idx_place_tags_slug on public.place_tags (tag_slug);

alter table public.place_tags enable row level security;

drop policy if exists "place_tags_public_read" on public.place_tags;
create policy "place_tags_public_read"
on public.place_tags for select
using (true);

drop policy if exists "place_tags_no_client_write" on public.place_tags;
create policy "place_tags_no_client_write"
on public.place_tags for insert
to authenticated, anon
with check (false);

-- Sincronización desde places.tagging_meta (automated_seed). El JSONB sigue
-- siendo la fuente de verdad; esta tabla es la vista relacional para features.
create or replace function public.sync_place_tags_from_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.place_tags
  where place_id = new.id and source = 'automated_seed';

  insert into public.place_tags (place_id, tag_slug, confidence, source, updated_at)
  select new.id, t.slug, t.confidence, 'automated_seed', now()
  from (
    select
      lower(trim(tag->>'slug')) as slug,
      max(
        case
          when (tag->>'confidence_score') ~ '^[0-9]*\.?[0-9]+$'
            then least(1, greatest(0, (tag->>'confidence_score')::numeric))
          else 0.5
        end
      ) as confidence
    from jsonb_array_elements(coalesce(new.tagging_meta->'automated_seed'->'tags', '[]'::jsonb)) as tag
    where coalesce(trim(tag->>'slug'), '') <> ''
    group by 1
  ) t;

  return new;
end;
$$;

drop trigger if exists trg_sync_place_tags on public.places;
create trigger trg_sync_place_tags
after insert or update of tagging_meta on public.places
for each row execute function public.sync_place_tags_from_meta();

-- Backfill de lugares existentes.
insert into public.place_tags (place_id, tag_slug, confidence, source)
select p.id, t.slug, t.confidence, 'automated_seed'
from public.places p
cross join lateral (
  select
    lower(trim(tag->>'slug')) as slug,
    max(
      case
        when (tag->>'confidence_score') ~ '^[0-9]*\.?[0-9]+$'
          then least(1, greatest(0, (tag->>'confidence_score')::numeric))
        else 0.5
      end
    ) as confidence
  from jsonb_array_elements(coalesce(p.tagging_meta->'automated_seed'->'tags', '[]'::jsonb)) as tag
  where coalesce(trim(tag->>'slug'), '') <> ''
  group by 1
) t
on conflict (place_id, tag_slug, source) do update
  set confidence = excluded.confidence,
      updated_at = now();
