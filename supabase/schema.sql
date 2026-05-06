-- =============================================================================
-- PICADA.APP — Schema completo (v2 — Madurez UX)
-- Ejecutar en Supabase SQL Editor. Idempotente: IF NOT EXISTS en todo.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm; -- búsqueda difusa por nombre de local

-- =============================================================================
-- TABLAS DE USUARIO
-- =============================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  bio         text default '',
  avatar_url  text,
  is_public   boolean default false,
  -- Gamificación
  points      int default 0,
  level       int default 1,   -- 1=Explorador 2=Picador 3=Crítico 4=Leyenda
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists public.user_preferences (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  likes         text[] default '{}',      -- ['picada','sushi','vegano','fitness']
  restrictions  text[] default '{}',      -- ['sin_gluten','keto','vegetariano','vegano']
  dislikes      text[] default '{}',      -- ['cilantro','aji','mariscos']
  religion      text default 'ninguna',   -- 'ninguna' | 'jewish' | 'muslim' | 'other'
  -- Experiencias buscadas (para matching)
  experiences   text[] default '{}',      -- ['chill','familiar','romantico','grupos','noche']
  -- Rango de precio preferido
  min_price     int default 1,
  max_price     int default 4,
  -- Ubicación
  location_label text default '',
  location_mode  text default 'manual',   -- 'manual' | 'auto'
  updated_at    timestamptz default now()
);

create table if not exists public.user_visits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  place_id      uuid references public.places(id) on delete set null,
  place_name    text not null,
  visited_at    timestamptz default now()
);

create table if not exists public.user_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  place_id    uuid references public.places(id) on delete set null,
  external_id text not null,
  title       text not null,
  author      text,
  source_url  text not null,
  created_at  timestamptz default now(),
  unique(user_id, external_id)
);

create table if not exists public.user_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  place_id      uuid references public.places(id) on delete set null,
  post_id       uuid references public.posts(id) on delete set null,
  place_name    text not null,
  review_text   text not null,
  rating        int check (rating between 1 and 5),
  mood_tags     text[] default '{}',
  is_incognito  boolean default false,
  visited_at    timestamptz,
  created_at    timestamptz default now()
);

-- =============================================================================
-- CATÁLOGO GLOBAL DE LOCALES
-- Fuente de datos enriquecida. Se puebla desde Google, OSM o usuarios.
-- Reemplaza el concepto de "cache de API" con un registro persistente real.
-- =============================================================================

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),

  -- Origen y estado
  provider        text not null default 'google',  -- 'google' | 'osm' | 'user' | 'manual'
  external_id     text,
  status          text default 'active'             -- 'active' | 'pending' | 'draft'
                  check (status in ('active','pending','draft')),

  -- Identidad
  name            text not null,
  address         text,
  commune         text,                             -- Comuna chilena (ej: Providencia)
  city            text,
  region          text,                             -- Región chilena (ej: Metropolitana)
  country         text default 'CL',
  phone           text,
  website         text,
  maps_url        text,

  -- Coordenadas
  lat             double precision,
  lng             double precision,

  -- Clasificación base
  rating          numeric(3,1),
  reviews_count   int default 0,
  price_level     int check (price_level between 1 and 4),
  opening_now     boolean,
  category        text,    -- 'picada' | 'restaurante' | 'cafe' | 'bar' | 'sangucheria' | 'otro'

  -- Arrays de clasificación (para matching y filtros)
  nutrition_categories  text[] default '{}',  -- ['keto','fitness','fastfood','vegano']
  restrictions_supported text[] default '{}', -- ['sin_gluten','halal','kosher','vegano']
  cuisines              text[] default '{}',  -- ['chilena','italiana','japonesa']
  source_types          text[] default '{}',
  experiences           text[] default '{}',  -- ['chill','familiar','romantico','grupos','noche']

  -- ── Flags dietéticos booleanos (índices rápidos para matching) ───────────────
  -- Derivados de restrictions_supported pero indexables con predicados simples
  is_vegetarian_friendly  boolean default false,
  is_vegan_friendly       boolean default false,
  is_gluten_free_friendly boolean default false,
  is_halal                boolean default false,
  is_kosher               boolean default false,
  is_keto_friendly        boolean default false,
  is_lactose_free         boolean default false,

  -- ── Features del local ───────────────────────────────────────────────────────
  has_delivery            boolean default false,
  has_takeout             boolean default false,
  has_outdoor_seating     boolean default false,
  has_wifi                boolean default false,
  has_parking             boolean default false,
  accepts_reservations    boolean default false,
  is_family_friendly      boolean default true,
  is_pet_friendly         boolean default false,
  is_open_late            boolean default false,   -- cierra después de 23:00

  -- ── Puntuación "Picada Score" ─────────────────────────────────────────────────
  -- 0-100: cuán "picada secreta" es el local.
  -- Alto = precio bajo + rating alto + poco conocido.
  picada_score    int default 50 check (picada_score between 0 and 100),

  -- Rating interno (promedio de user_reviews)
  internal_rating       numeric(3,2),
  internal_rating_count int default 0,

  -- Media
  gallery         jsonb default '[]'::jsonb,   -- [{url, source, is_primary}]
  raw_payload     jsonb default '{}'::jsonb,

  -- Trazabilidad comunitaria
  submitted_by    uuid references auth.users(id) on delete set null,
  verified_by     uuid references auth.users(id) on delete set null,
  first_photo_by  uuid references auth.users(id) on delete set null,  -- +10 pts

  content_hash    text,
  last_synced_at  timestamptz default now(),
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(provider, external_id)
);

-- Índices para búsqueda geoespacial y matching
create index if not exists idx_places_lat_lng          on public.places(lat, lng);
create index if not exists idx_places_provider_external on public.places(provider, external_id);
create index if not exists idx_places_commune          on public.places(commune);
create index if not exists idx_places_city_region      on public.places(city, region);
create index if not exists idx_places_status           on public.places(status);
create index if not exists idx_places_category         on public.places(category);
create index if not exists idx_places_price            on public.places(price_level);
-- Búsqueda difusa por nombre
create index if not exists idx_places_name_trgm        on public.places using gin(name gin_trgm_ops);
-- Matching por arrays
create index if not exists idx_places_nutrition_categories   on public.places using gin(nutrition_categories);
create index if not exists idx_places_restrictions_supported on public.places using gin(restrictions_supported);
create index if not exists idx_places_cuisines               on public.places using gin(cuisines);
create index if not exists idx_places_experiences            on public.places using gin(experiences);

-- =============================================================================
-- ITEMS DE MENÚ — Platos con datos nutricionales
-- =============================================================================

create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  place_name  text not null,
  place_id    uuid references public.places(id) on delete set null,
  item_name   text not null,
  review_text text default '',
  rating      int check (rating between 1 and 5),
  photo_url   text,
  nutrition   jsonb default '{}'::jsonb,  -- {kcal,protein,carbs,fat,source}
  show_nutrition boolean default true,
  source      text default 'community',   -- 'community' | 'official' | 'ai'
  is_official boolean default false,
  upvotes_count int default 0,
  impact_score  numeric default 0,
  photo_votes   jsonb default '{}'::jsonb,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);

create index if not exists idx_menu_items_place_name on public.menu_items(place_name);
create index if not exists idx_menu_items_place_item on public.menu_items(place_name, item_name);
create index if not exists idx_menu_items_place_id   on public.menu_items(place_id);

-- =============================================================================
-- POSTS — Contenido del botón "+" (motor social)
-- Soporta: reseña, foto/video, incógnito, tips
-- =============================================================================

create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),

  -- Autoría
  -- is_incognito=true → user_id guardado en BD pero NUNCA expuesto en queries de app
  user_id       uuid references auth.users(id) on delete cascade,
  place_id      uuid references public.places(id) on delete set null,

  -- Tipo de contenido
  type          text not null
                check (type in ('review','photo','video','incognito','tip')),

  -- Contenido
  content       text,                    -- texto del comentario / reseña
  rating        int check (rating between 1 and 5),
  mood_tags     text[] default '{}',
  -- ['chill','familiar','romantico','grupos','trabajo','noche','economico','especial']

  -- Para posts sin local vinculado (tip libre, incógnito sin tag)
  place_name    text,
  place_lat     double precision,
  place_lng     double precision,

  -- Incógnito: la app muestra "Foodie Fantasma 👻" en lugar del username real
  is_incognito  boolean default false,

  -- Datos nutricionales opcionales (del scanner de IA)
  -- { "dish": "Sandwich de Mechada", "kcal": 520, "protein": 32,
  --   "carbs": 48, "fat": 18, "source": "AI_GENERATED" }
  nutrition_data jsonb,

  -- Engagement
  likes_count   int default 0,
  views_count   int default 0,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_posts_place_id   on public.posts(place_id);
create index if not exists idx_posts_user_id    on public.posts(user_id);
create index if not exists idx_posts_type       on public.posts(type);
create index if not exists idx_posts_created_at on public.posts(created_at desc);

-- =============================================================================
-- MEDIA DE POSTS
-- =============================================================================

create table if not exists public.post_media (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  url         text not null,
  media_type  text not null check (media_type in ('photo','video')),
  sort_order  int default 0,
  created_at  timestamptz default now()
);

create index if not exists idx_post_media_post_id on public.post_media(post_id);

-- =============================================================================
-- GAMIFICACIÓN — Registro de puntos por acción
-- Acciones y puntos:
--   create_picada    → +15  (crear local nuevo)
--   first_photo      → +10  (primera foto real de un borrador)
--   post_review      → +5   (reseña con texto ≥ 10 chars)
--   post_media       → +8   (subir foto/video)
--   complete_draft   → +10  (completar datos faltantes de un borrador)
--   first_visit      → +3   (registrar visita a un local)
-- =============================================================================

create table if not exists public.user_points (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  action       text not null,
  points       int not null,
  reference_id uuid,   -- place_id o post_id que originó los puntos
  created_at   timestamptz default now()
);

create index if not exists idx_user_points_user_id on public.user_points(user_id);

-- =============================================================================
-- SOCIAL: FOLLOWS
-- =============================================================================

create table if not exists public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  text not null,
  following_id text not null,
  created_at   timestamptz default now(),
  unique(follower_id, following_id)
);

-- =============================================================================
-- SAVED ITEMS (favoritos granulares de platos)
-- =============================================================================

create table if not exists public.saved_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  kind         text default 'pending',  -- 'pending' | 'favorite'
  created_at   timestamptz default now(),
  unique(user_id, menu_item_id)
);

-- =============================================================================
-- CACHÉ Y AUDITORÍA DE DATOS EXTERNOS
-- =============================================================================

create table if not exists public.place_change_log (
  id               uuid primary key default gen_random_uuid(),
  place_id         uuid not null references public.places(id) on delete cascade,
  previous_payload jsonb not null,
  current_payload  jsonb not null,
  changed_fields   text[] default '{}',
  detected_at      timestamptz default now()
);

create table if not exists public.place_discovery_cache (
  id           uuid primary key default gen_random_uuid(),
  location_key text unique not null,
  source       text not null,
  place_ids    uuid[] default '{}',
  payload      jsonb not null default '[]'::jsonb,
  fetched_at   timestamptz default now(),
  expires_at   timestamptz not null
);

-- =============================================================================
-- FUNCIONES
-- =============================================================================

-- ── Picada Score ──────────────────────────────────────────────────────────────
-- Lógica: precio bajo + rating alto + poca visibilidad = local más "picada"

create or replace function public.compute_picada_score(
  p_price_level   int,
  p_rating        numeric,
  p_rating_count  int
) returns int language plpgsql immutable as $$
declare
  score int := 50;
begin
  -- Precio: más barato → más picada
  score := score + case p_price_level
    when 1 then  25
    when 2 then  10
    when 3 then  -5
    when 4 then -20
    else 0
  end;

  -- Rating: si existe y es alto → mejor picada
  if p_rating is not null then
    score := score + round((p_rating - 3.0) * 10)::int;
  end if;

  -- Obscuridad: pocos reviews → local más "secreto"
  score := score + case
    when p_rating_count is null or p_rating_count = 0 then  15
    when p_rating_count < 10                           then  10
    when p_rating_count < 50                           then   5
    when p_rating_count < 200                          then   0
    else                                                    -10
  end;

  return greatest(0, least(100, score));
end;
$$;

-- ── Rating interno: recalcular al insertar/actualizar reseña ──────────────────

create or replace function public.refresh_place_rating()
returns trigger language plpgsql security definer as $$
begin
  update public.places
  set
    internal_rating = (
      select round(avg(rating)::numeric, 2)
      from public.user_reviews
      where place_id = new.place_id and rating is not null
    ),
    internal_rating_count = (
      select count(*)
      from public.user_reviews
      where place_id = new.place_id and rating is not null
    ),
    updated_at = now()
  where id = new.place_id;
  return new;
end;
$$;

create or replace trigger trg_refresh_place_rating
after insert or update on public.user_reviews
for each row
when (new.place_id is not null and new.rating is not null)
execute function public.refresh_place_rating();

-- ── Match Score: cuán compatible es un local con las preferencias del usuario ──
-- Retorna 0-100. La app lo usa para ordenar resultados del feed.
--
-- Lógica de penalizaciones (decisiones de diseño importantes):
--   - Restricciones dietéticas NO cubiertas: penalización alta (40-50 pts)
--     porque mostrar un restaurante "no apto" a alguien celíaco o musulmán
--     es peor que no mostrarlo. Son necesidades reales, no preferencias.
--   - Restricciones religiosas: penalización máxima (50 pts) por el mismo motivo.
--   - Gustos no coincidentes: penalización leve (5 pts) — son opcionales.
--   - Precio fuera de rango: penalización media (15 pts).

create or replace function public.place_match_score(
  p_place_id uuid,
  p_user_id  uuid
) returns int language plpgsql stable as $$
declare
  prefs  public.user_preferences%rowtype;
  place  public.places%rowtype;
  score  int := 50;
  bonus  int := 0;
  penalty int := 0;
begin
  select * into prefs from public.user_preferences where user_id = p_user_id;
  select * into place from public.places           where id = p_place_id;

  if not found then return 50; end if;

  -- ── Bonus: coincidencia de gustos (cuisines y categoría) ─────────────────
  if prefs.likes && place.cuisines then
    bonus := bonus + 20;
  end if;
  if prefs.likes && place.nutrition_categories then
    bonus := bonus + 10;
  end if;

  -- ── Bonus: experiencias buscadas ─────────────────────────────────────────
  if prefs.experiences && place.experiences then
    bonus := bonus + 15;
  end if;

  -- ── Bonus: alta puntuación del local ─────────────────────────────────────
  if place.rating is not null and place.rating >= 4.5 then
    bonus := bonus + 8;
  end if;

  -- ── Penalización: restricciones dietéticas no satisfechas ────────────────
  if 'sin_gluten'  = any(prefs.restrictions) and not place.is_gluten_free_friendly then
    penalty := penalty + 45;
  end if;
  if 'vegano'      = any(prefs.restrictions) and not place.is_vegan_friendly then
    penalty := penalty + 45;
  end if;
  if 'vegetariano' = any(prefs.restrictions) and not place.is_vegetarian_friendly then
    penalty := penalty + 35;
  end if;
  if 'keto'        = any(prefs.restrictions) and not place.is_keto_friendly then
    penalty := penalty + 20;
  end if;
  if 'sin_lactosa' = any(prefs.restrictions) and not place.is_lactose_free then
    penalty := penalty + 15;
  end if;

  -- ── Penalización: restricciones religiosas ────────────────────────────────
  if prefs.religion = 'muslim' and not place.is_halal then
    penalty := penalty + 50;
  end if;
  if prefs.religion = 'jewish' and not place.is_kosher then
    penalty := penalty + 50;
  end if;

  -- ── Precio fuera del rango preferido ─────────────────────────────────────
  if place.price_level is not null then
    if place.price_level < prefs.min_price or place.price_level > prefs.max_price then
      penalty := penalty + 15;
    else
      bonus := bonus + 5;
    end if;
  end if;

  return greatest(0, least(100, score + bonus - penalty));
end;
$$;

-- =============================================================================
-- VISTAS
-- =============================================================================

-- Leaderboard público de contribuidores
create or replace view public.user_leaderboard as
select
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  coalesce(sum(up.points), 0)::int as total_points,
  count(distinct up.id)::int        as actions_count
from public.profiles p
left join public.user_points up on up.user_id = p.id
where p.is_public = true
group by p.id, p.username, p.avatar_url, p.level
order by total_points desc;

-- Feed de posts (no expone user_id de posts incógnito)
create or replace view public.posts_feed as
select
  po.id,
  po.place_id,
  po.type,
  po.content,
  po.rating,
  po.mood_tags,
  po.place_name,
  po.is_incognito,
  po.nutrition_data,
  po.likes_count,
  po.views_count,
  po.created_at,
  -- Incógnito: mostrar solo que existe un autor, sin identificarlo
  case when po.is_incognito then null else po.user_id end as user_id,
  case when po.is_incognito then 'Foodie Fantasma' else pr.username end as author_name,
  case when po.is_incognito then null else pr.avatar_url end as author_avatar,
  pl.name    as place_name_linked,
  pl.commune as place_commune,
  pl.lat     as place_lat,
  pl.lng     as place_lng
from public.posts po
left join public.profiles pr on pr.id = po.user_id
left join public.places   pl on pl.id = po.place_id
order by po.created_at desc;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles            enable row level security;
alter table public.user_preferences    enable row level security;
alter table public.user_favorites      enable row level security;
alter table public.user_reviews        enable row level security;
alter table public.user_visits         enable row level security;
alter table public.places              enable row level security;
alter table public.menu_items          enable row level security;
alter table public.posts               enable row level security;
alter table public.post_media          enable row level security;
alter table public.user_points         enable row level security;
alter table public.follows             enable row level security;
alter table public.saved_items         enable row level security;
alter table public.place_change_log    enable row level security;
alter table public.place_discovery_cache enable row level security;

-- ── Profiles ─────────────────────────────────────────────────────────────────

create policy if not exists "profiles_public_read"
on public.profiles for select
using (is_public = true or auth.uid() = id);

create policy if not exists "profiles_owner_write"
on public.profiles for all
using (auth.uid() = id)
with check (auth.uid() = id);

-- ── User preferences ─────────────────────────────────────────────────────────

create policy if not exists "prefs_owner_only"
on public.user_preferences for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ── Favorites ────────────────────────────────────────────────────────────────

create policy if not exists "favorites_public_if_profile_public"
on public.user_favorites for select
using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p
    where p.id = user_id and p.is_public = true
  )
);

create policy if not exists "favorites_owner_write"
on public.user_favorites for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ── Reviews ──────────────────────────────────────────────────────────────────

create policy if not exists "reviews_public_if_profile_public"
on public.user_reviews for select
using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p
    where p.id = user_id and p.is_public = true
  )
);

create policy if not exists "reviews_owner_write"
on public.user_reviews for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ── Visits ───────────────────────────────────────────────────────────────────

create policy if not exists "visits_public_if_profile_public"
on public.user_visits for select
using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p
    where p.id = user_id and p.is_public = true
  )
);

create policy if not exists "visits_owner_write"
on public.user_visits for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ── Places (locales) ─────────────────────────────────────────────────────────
-- Locales activos: lectura pública para todos.
-- Borradores (status='draft'): visibles solo para su creador.

create policy if not exists "places_active_public_read"
on public.places for select
using (
  status = 'active'
  or auth.uid() = submitted_by
);

create policy if not exists "places_user_insert"
on public.places for insert
with check (auth.uid() = submitted_by);

create policy if not exists "places_owner_update"
on public.places for update
using (auth.uid() = submitted_by)
with check (auth.uid() = submitted_by);

-- ── Menu items ───────────────────────────────────────────────────────────────

create policy if not exists "menu_items_public_read"
on public.menu_items for select
using (true);

create policy if not exists "menu_items_no_client_write"
on public.menu_items for all
using (false)
with check (false);

-- ── Posts ────────────────────────────────────────────────────────────────────
-- Lectura pública: usa la vista posts_feed que ya filtra el user_id incógnito.

create policy if not exists "posts_public_read"
on public.posts for select
using (true);

create policy if not exists "posts_owner_insert"
on public.posts for insert
with check (auth.uid() = user_id or is_incognito = true);

create policy if not exists "posts_owner_update"
on public.posts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "posts_owner_delete"
on public.posts for delete
using (auth.uid() = user_id);

-- ── Post media ───────────────────────────────────────────────────────────────

create policy if not exists "post_media_public_read"
on public.post_media for select
using (true);

create policy if not exists "post_media_owner_write"
on public.post_media for all
using (
  exists (
    select 1 from public.posts p
    where p.id = post_id and p.user_id = auth.uid()
  )
);

-- ── User points ──────────────────────────────────────────────────────────────

create policy if not exists "points_owner_read"
on public.user_points for select
using (auth.uid() = user_id);

create policy if not exists "points_service_insert"
on public.user_points for insert
with check (auth.uid() = user_id);

-- ── Follows ──────────────────────────────────────────────────────────────────

create policy if not exists "follows_public_read"
on public.follows for select
using (true);

create policy if not exists "follows_no_client_write"
on public.follows for all
using (false)
with check (false);

-- ── Saved items ──────────────────────────────────────────────────────────────

create policy if not exists "saved_items_public_read"
on public.saved_items for select
using (true);

create policy if not exists "saved_items_no_client_write"
on public.saved_items for all
using (false)
with check (false);

-- ── Caché y auditoría ────────────────────────────────────────────────────────

create policy if not exists "place_change_log_read"
on public.place_change_log for select
using (true);

create policy if not exists "place_change_log_no_client_write"
on public.place_change_log for all
using (false)
with check (false);

create policy if not exists "place_discovery_cache_read"
on public.place_discovery_cache for select
using (true);

create policy if not exists "place_discovery_cache_no_client_write"
on public.place_discovery_cache for all
using (false)
with check (false);

-- =============================================================================
-- STORAGE
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('place-gallery', 'place-gallery', true)
on conflict (id) do nothing;

-- =============================================================================
-- PHASE 3.2 — EVENTOS DE DOMINIO + RANKING EVENT-DRIVEN
-- =============================================================================

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
