-- =============================================================================
-- PICADA.APP — Schema de referencia (sincronizado con BD real)
-- Última actualización: 2026-05-06
--
-- INSTRUCCIONES DE APLICACIÓN:
--   1. Ejecutar este archivo en el SQL Editor de Supabase (idempotente).
--   2. Luego aplicar cada archivo en supabase/migrations/ en orden cronológico.
--
-- TABLAS REALES EN PRODUCCIÓN:
--   places, place_change_log, place_discovery_cache,
--   content_submissions, tag_catalog, tag_relations_stats,
--   tag_relation_user_pair, domain_events, user_tag_affinity
--
-- TABLAS NO IMPLEMENTADAS AÚN (definir en futuras migraciones si se necesitan):
--   profiles, user_preferences, user_visits, user_reviews,
--   posts, post_media, menu_items, user_points, follows, saved_items
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- CATÁLOGO GLOBAL DE LOCALES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.places (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Origen
  provider         text NOT NULL DEFAULT 'google',  -- 'google' | 'osm' | 'user' | 'manual'
  external_id      text,
  status           text DEFAULT 'active'
                   CHECK (status IN ('active', 'pending', 'draft')),

  -- Identidad
  name             text NOT NULL,
  address          text,
  commune          text,
  city             text,
  region           text,
  country          text DEFAULT 'CL',
  phone            text,
  website          text,
  maps_url         text,

  -- Coordenadas
  lat              double precision,
  lng              double precision,

  -- Clasificación base
  rating           numeric(3,1),
  reviews_count    int DEFAULT 0,
  price_level      int CHECK (price_level BETWEEN 1 AND 4),
  category         text,

  -- Arrays de clasificación (para matching y filtros)
  -- restrictions_supported: 'vegetariano','vegano','sin_gluten','halal','kosher','keto','sin_lactosa'
  restrictions_supported text[] DEFAULT '{}',
  -- amenities: 'delivery','takeout','outdoor_seating','wifi','parking','reservations',
  --            'family_friendly','pet_friendly','open_late'
  amenities        text[] DEFAULT '{}',
  -- nutrition_categories: 'keto','fitness','fastfood','vegano'
  nutrition_categories text[] DEFAULT '{}',
  -- cuisines: 'chilena','italiana','japonesa', etc.
  cuisines         text[] DEFAULT '{}',
  -- source_types: tipo de fuente de datos
  source_types     text[] DEFAULT '{}',
  -- experiences: 'chill','familiar','romantico','grupos','noche'
  experiences      text[] DEFAULT '{}',

  -- Puntuación "Picada Score" (0–100)
  picada_score     int DEFAULT 50 CHECK (picada_score BETWEEN 0 AND 100),

  -- Rating interno (promedio de reseñas de la comunidad)
  internal_rating       numeric(3,2),
  internal_rating_count int DEFAULT 0,

  -- Media y payload crudo de Google Maps
  gallery          jsonb DEFAULT '[]'::jsonb,
  raw_payload      jsonb DEFAULT '{}'::jsonb,

  -- Metadatos de auto-tagging (IA + comunidad)
  tagging_meta     jsonb DEFAULT '{}'::jsonb,

  -- Trazabilidad comunitaria
  submitted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_photo_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  content_hash     text,
  last_synced_at   timestamptz DEFAULT now(),
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),

  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_places_lat_lng               ON public.places(lat, lng);
CREATE INDEX IF NOT EXISTS idx_places_provider_external     ON public.places(provider, external_id);
CREATE INDEX IF NOT EXISTS idx_places_commune               ON public.places(commune);
CREATE INDEX IF NOT EXISTS idx_places_city_region           ON public.places(city, region);
CREATE INDEX IF NOT EXISTS idx_places_status                ON public.places(status);
CREATE INDEX IF NOT EXISTS idx_places_category              ON public.places(category);
CREATE INDEX IF NOT EXISTS idx_places_price                 ON public.places(price_level);
CREATE INDEX IF NOT EXISTS idx_places_name_trgm             ON public.places USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_places_restrictions          ON public.places USING gin(restrictions_supported);
CREATE INDEX IF NOT EXISTS idx_places_amenities             ON public.places USING gin(amenities);
CREATE INDEX IF NOT EXISTS idx_places_nutrition_categories  ON public.places USING gin(nutrition_categories);
CREATE INDEX IF NOT EXISTS idx_places_cuisines              ON public.places USING gin(cuisines);
CREATE INDEX IF NOT EXISTS idx_places_experiences           ON public.places USING gin(experiences);
CREATE INDEX IF NOT EXISTS idx_places_tagging_seed          ON public.places
  ((tagging_meta -> 'automated_seed' ->> 'generated_at'))
  WHERE (tagging_meta -> 'automated_seed') IS NOT NULL;

-- =============================================================================
-- AUDITORÍA Y CACHÉ DE DATOS EXTERNOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.place_change_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id         uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  previous_payload jsonb NOT NULL,
  current_payload  jsonb NOT NULL,
  changed_fields   text[] DEFAULT '{}',
  detected_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.place_discovery_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_key text UNIQUE NOT NULL,
  source       text NOT NULL,
  place_ids    uuid[] DEFAULT '{}',
  payload      jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at   timestamptz DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

-- =============================================================================
-- SISTEMA DE TAGS
-- =============================================================================

-- Catálogo global de tags validados
-- category: 'food' | 'dress' | 'ambience' | 'local' | 'service'
CREATE TABLE IF NOT EXISTS public.tag_catalog (
  slug         text PRIMARY KEY,
  display_name text NOT NULL,
  category     text NOT NULL
               CHECK (category IN ('food', 'dress', 'ambience', 'local', 'service')),
  status       text DEFAULT 'verified',
  created_at   timestamptz DEFAULT now()
);

-- Co-ocurrencia agregada entre tags (para sugerencias)
CREATE TABLE IF NOT EXISTS public.tag_relations_stats (
  id                  bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  source_tag          text REFERENCES public.tag_catalog(slug),
  target_tag          text REFERENCES public.tag_catalog(slug),
  relation_type       text NOT NULL,
  co_occurrence_count int DEFAULT 0,
  unique_users_count  int DEFAULT 0,
  last_updated        timestamptz DEFAULT now(),
  UNIQUE (source_tag, target_tag, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_tag_relations_source_type
  ON public.tag_relations_stats(source_tag, relation_type, co_occurrence_count DESC);

-- Pares individuales de co-ocurrencia por usuario (fuente de verdad)
CREATE TABLE IF NOT EXISTS public.tag_relation_user_pair (
  source_tag    text NOT NULL REFERENCES public.tag_catalog(slug),
  target_tag    text NOT NULL REFERENCES public.tag_catalog(slug),
  relation_type text NOT NULL,
  user_id       uuid NOT NULL,
  created_at    timestamptz DEFAULT now(),
  PRIMARY KEY (source_tag, target_tag, relation_type, user_id)
);

-- Afinidad acumulada de un usuario con cada tag
CREATE TABLE IF NOT EXISTS public.user_tag_affinity (
  user_id    uuid NOT NULL,
  tag_slug   text NOT NULL,
  weight     integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag_slug)
);

CREATE INDEX IF NOT EXISTS idx_user_tag_affinity_user    ON public.user_tag_affinity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tag_affinity_weight  ON public.user_tag_affinity(weight DESC);
CREATE INDEX IF NOT EXISTS idx_user_tag_affinity_updated ON public.user_tag_affinity(updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tag_affinity_user_tag
  ON public.user_tag_affinity(user_id, tag_slug);

-- =============================================================================
-- EVENTOS DE DOMINIO (gamificación + ranking event-driven)
-- =============================================================================

-- user_id text: soporta usuarios anónimos (localStorage ID).
-- auth_user_id uuid: FK válido cuando el usuario está autenticado.
CREATE TABLE IF NOT EXISTS public.domain_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text NOT NULL
                CHECK (event_type IN (
                  'CONTENT_CREATED', 'USER_VOTED', 'USER_REVIEWED',
                  'USER_SAVED', 'USER_VISITED', 'USER_SCANNED'
                )),
  user_id       text,
  auth_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  username      text,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_at      timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_event_type    ON public.domain_events(event_type);
CREATE INDEX IF NOT EXISTS idx_domain_events_event_at      ON public.domain_events(event_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_user_id       ON public.domain_events(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_auth_user_id  ON public.domain_events(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_payload_gin   ON public.domain_events USING gin(payload);

-- =============================================================================
-- ANALYTICS DE SUBMISSIONS (tabla de auditoría del formulario de publicación)
-- =============================================================================

-- user_id text: soporta usuarios anónimos.
-- auth_user_id uuid: FK válido cuando el usuario está autenticado.
-- place_id text: puede referenciar external_id de Google antes de que el local
--   sea registrado como uuid en places; no se puede convertir a FK.
CREATE TABLE IF NOT EXISTS public.content_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id       text,
  auth_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  username      text,

  entry_type    text NOT NULL
                CHECK (entry_type IN ('review', 'media', 'incognito', 'new-picada')),
  content_type  text NOT NULL
                CHECK (content_type IN ('review', 'photo', 'video', 'incognito', 'tip')),

  is_incognito  boolean NOT NULL DEFAULT false,
  has_media     boolean NOT NULL DEFAULT false,
  media_kind    text CHECK (media_kind IN ('photo', 'video')),
  has_comment   boolean NOT NULL DEFAULT false,
  comment_length int NOT NULL DEFAULT 0,
  rating        int CHECK (rating BETWEEN 1 AND 5),

  place_id      text,
  place_name    text,
  place_address text,

  category      text,
  tags          text[] NOT NULL DEFAULT '{}',
  moods         text[] NOT NULL DEFAULT '{}',

  quality_score    int NOT NULL DEFAULT 0,
  engagement_score int NOT NULL DEFAULT 0,
  completeness     int NOT NULL DEFAULT 0,

  payload   jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed  jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_submissions_created_at   ON public.content_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_submissions_user_id      ON public.content_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_submissions_auth_user_id ON public.content_submissions(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_content_submissions_entry_type   ON public.content_submissions(entry_type);
CREATE INDEX IF NOT EXISTS idx_content_submissions_content_type ON public.content_submissions(content_type);
CREATE INDEX IF NOT EXISTS idx_content_submissions_place_name   ON public.content_submissions(place_name);
CREATE INDEX IF NOT EXISTS idx_content_submissions_tags_gin     ON public.content_submissions USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_content_submissions_payload_gin  ON public.content_submissions USING gin(payload);

-- =============================================================================
-- FUNCIONES
-- =============================================================================

-- Picada Score: precio bajo + rating alto + poca visibilidad = más "picada"
CREATE OR REPLACE FUNCTION public.compute_picada_score(
  p_price_level  int,
  p_rating       numeric,
  p_rating_count int
) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  score int := 50;
BEGIN
  score := score + CASE p_price_level
    WHEN 1 THEN  25
    WHEN 2 THEN  10
    WHEN 3 THEN  -5
    WHEN 4 THEN -20
    ELSE 0
  END;

  IF p_rating IS NOT NULL THEN
    score := score + round((p_rating - 3.0) * 10)::int;
  END IF;

  score := score + CASE
    WHEN p_rating_count IS NULL OR p_rating_count = 0 THEN  15
    WHEN p_rating_count < 10                           THEN  10
    WHEN p_rating_count < 50                           THEN   5
    WHEN p_rating_count < 200                          THEN   0
    ELSE                                                    -10
  END;

  RETURN greatest(0, least(100, score));
END;
$$;

-- Recomendaciones personalizadas basadas en afinidad de tags
CREATE OR REPLACE FUNCTION public.get_personalized_recommendations(
  p_user_id uuid,
  p_limit   int DEFAULT 5,
  p_city    text DEFAULT null
)
RETURNS TABLE (
  place_id    uuid,
  name        text,
  address     text,
  city        text,
  rating      numeric,
  picada_score int,
  maps_url    text,
  photo_url   text,
  score       numeric,
  reason      text
)
LANGUAGE sql STABLE AS $$
WITH params AS (
  SELECT
    greatest(1, least(COALESCE(p_limit, 5), 20)) AS lim,
    greatest(1, ceil(greatest(1, least(COALESCE(p_limit, 5), 20)) * 0.2)::int) AS ser_lim
),
user_aff AS (
  SELECT
    uta.tag_slug,
    (uta.weight * (1.0 / (1.0 + (extract(day FROM now() - uta.updated_at) * 0.05))))::numeric AS eff_weight
  FROM public.user_tag_affinity uta
  WHERE uta.user_id = p_user_id
  ORDER BY eff_weight DESC
  LIMIT 10
),
candidate_places AS (
  SELECT
    p.id,
    p.name,
    p.address,
    p.city,
    p.rating,
    p.picada_score,
    p.maps_url,
    CASE
      WHEN jsonb_typeof(p.gallery) = 'array' AND jsonb_array_length(p.gallery) > 0
        THEN p.gallery ->> 0
      ELSE null
    END AS photo_url,
    sum(
      ua.eff_weight *
      COALESCE((seed.tag ->> 'confidence_score')::numeric, 0.5)
    ) AS base_score
  FROM public.places p
  JOIN LATERAL jsonb_array_elements(
    COALESCE(p.tagging_meta -> 'automated_seed' -> 'tags', '[]'::jsonb)
  ) AS seed(tag) ON true
  JOIN user_aff ua ON lower(seed.tag ->> 'slug') = lower(ua.tag_slug)
  WHERE (p.is_active IS NULL OR p.is_active = true)
    AND (p_city IS NULL OR p_city = '' OR p.city ILIKE ('%' || p_city || '%'))
  GROUP BY p.id, p.name, p.address, p.city, p.rating, p.picada_score, p.maps_url, p.gallery
),
core_ranked AS (
  SELECT
    cp.id AS place_id,
    cp.name, cp.address, cp.city, cp.rating, cp.picada_score, cp.maps_url, cp.photo_url,
    (
      cp.base_score
      * greatest(1, COALESCE(cp.rating, 0))
      * CASE
          WHEN p_city IS NOT NULL AND p_city <> '' AND cp.city ILIKE ('%' || p_city || '%')
          THEN 1.10 ELSE 1.00
        END
    )::numeric AS score,
    'affinity'::text AS reason
  FROM candidate_places cp
  ORDER BY score DESC
  LIMIT ((SELECT lim FROM params) - (SELECT ser_lim FROM params))
),
serendipia AS (
  SELECT
    p.id AS place_id,
    p.name, p.address, p.city, p.rating, p.picada_score, p.maps_url,
    CASE
      WHEN jsonb_typeof(p.gallery) = 'array' AND jsonb_array_length(p.gallery) > 0
        THEN p.gallery ->> 0
      ELSE null
    END AS photo_url,
    (greatest(1, COALESCE(p.rating, 0)) * 8 + greatest(0, COALESCE(p.picada_score, 0)) * 0.2)::numeric AS score,
    'serendipia'::text AS reason
  FROM public.places p
  WHERE (p.is_active IS NULL OR p.is_active = true)
    AND (p_city IS NULL OR p_city = '' OR p.city ILIKE ('%' || p_city || '%'))
    AND p.rating >= 4
    AND NOT EXISTS (SELECT 1 FROM core_ranked c WHERE c.place_id = p.id)
  ORDER BY random()
  LIMIT (SELECT ser_lim FROM params)
)
SELECT * FROM core_ranked
UNION ALL
SELECT * FROM serendipia
ORDER BY score DESC
LIMIT (SELECT lim FROM params);
$$;

-- Trigger de recompensas por contribución (requiere tabla profiles)
-- Se activa solo si profiles existe; de lo contrario no hace nada.
CREATE OR REPLACE FUNCTION public.handle_contribution_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_delta   integer := 0;
BEGIN
  v_user_id := nullif((to_jsonb(NEW) ->> 'user_id'), '')::uuid;
  IF v_user_id IS NULL THEN
    v_user_id := nullif((to_jsonb(NEW) ->> 'author_id'), '')::uuid;
  END IF;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  IF tg_table_name = 'posts' THEN
    v_delta := 50;
  ELSIF tg_table_name IN ('reviews', 'place_tags') THEN
    v_delta := 10;
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET
    points = COALESCE(points, 0) + v_delta,
    level  = floor(sqrt((COALESCE(points, 0) + v_delta)::numeric / 100.0))::int + 1,
    updated_at = now()
  WHERE id = v_user_id;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- VISTAS
-- =============================================================================

-- Leaderboard basado en eventos (la fuente de verdad del ranking)
CREATE OR REPLACE VIEW public.user_event_leaderboard AS
SELECT
  COALESCE(NULLIF(de.user_id, ''), 'anon') AS user_id,
  COALESCE(max(NULLIF(de.username, '')), 'foodie') AS username,
  count(*) FILTER (WHERE de.event_type = 'USER_REVIEWED')::int           AS reviews_count,
  count(*) FILTER (WHERE de.event_type = 'USER_VISITED')::int            AS visits_count,
  count(*) FILTER (WHERE de.event_type = 'USER_VOTED'
    AND COALESCE((de.payload ->> 'voted')::boolean, true))::int          AS votes_count,
  sum(greatest(0, COALESCE((de.payload ->> 'xp')::int, 0)))::int        AS total_xp,
  (
    sum(greatest(0, COALESCE((de.payload ->> 'xp')::int, 0))) +
    count(*) FILTER (WHERE de.event_type = 'USER_REVIEWED') * 25 +
    count(*) FILTER (WHERE de.event_type = 'USER_VISITED') * 8 +
    count(*) FILTER (WHERE de.event_type = 'USER_VOTED'
      AND COALESCE((de.payload ->> 'voted')::boolean, true)) * 4
  )::int AS score
FROM public.domain_events de
GROUP BY COALESCE(NULLIF(de.user_id, ''), 'anon')
ORDER BY score DESC, total_xp DESC;

-- Ranking de locales por actividad comunitaria
CREATE OR REPLACE VIEW public.picada_event_ranking AS
WITH votes AS (
  SELECT
    COALESCE(
      NULLIF(de.payload ->> 'picadaId', ''),
      NULLIF(de.payload ->> 'placeId', ''),
      NULLIF(de.payload ->> 'placeName', ''),
      'unknown'
    ) AS picada_id,
    sum(
      CASE
        WHEN de.event_type = 'USER_VOTED' AND COALESCE((de.payload ->> 'voted')::boolean, true) THEN 1
        WHEN de.event_type = 'USER_VOTED' AND NOT COALESCE((de.payload ->> 'voted')::boolean, true) THEN -1
        ELSE 0
      END
    )::int AS votes_net,
    count(*) FILTER (WHERE de.event_type = 'USER_VISITED')::int  AS visits_count,
    count(*) FILTER (WHERE de.event_type = 'USER_REVIEWED')::int AS reviews_count
  FROM public.domain_events de
  WHERE de.event_type IN ('USER_VOTED', 'USER_VISITED', 'USER_REVIEWED')
  GROUP BY 1
)
SELECT
  picada_id,
  greatest(0, votes_net)   AS community_votes,
  visits_count,
  reviews_count,
  (greatest(0, votes_net) * 9 + reviews_count * 6 + visits_count * 3)::int AS ranking_score
FROM votes
WHERE picada_id <> 'unknown'
ORDER BY ranking_score DESC, community_votes DESC;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.places                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_change_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_discovery_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_catalog           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_relations_stats   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_relation_user_pair ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tag_affinity     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_submissions   ENABLE ROW LEVEL SECURITY;

-- ── places ───────────────────────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "places_active_public_read" ON public.places
  FOR SELECT USING (status = 'active' OR auth.uid() = submitted_by);

CREATE POLICY IF NOT EXISTS "places_user_insert" ON public.places
  FOR INSERT WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY IF NOT EXISTS "places_owner_update" ON public.places
  FOR UPDATE USING (auth.uid() = submitted_by) WITH CHECK (auth.uid() = submitted_by);

-- ── place_change_log ─────────────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "place_change_log_read" ON public.place_change_log
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "place_change_log_no_client_write" ON public.place_change_log
  FOR ALL USING (false) WITH CHECK (false);

-- ── place_discovery_cache ─────────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "place_discovery_cache_read" ON public.place_discovery_cache
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "place_discovery_cache_no_client_write" ON public.place_discovery_cache
  FOR ALL USING (false) WITH CHECK (false);

-- ── tag_catalog ───────────────────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "tag_catalog_public_read" ON public.tag_catalog
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "tag_catalog_no_client_write" ON public.tag_catalog
  FOR ALL USING (false) WITH CHECK (false);

-- ── tag_relations_stats ───────────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "tag_relations_read_all" ON public.tag_relations_stats
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "tag_relations_no_client_write" ON public.tag_relations_stats
  FOR ALL USING (false) WITH CHECK (false);

-- ── tag_relation_user_pair ────────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "tag_relation_user_pair_read" ON public.tag_relation_user_pair
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "tag_relation_user_pair_no_client_write" ON public.tag_relation_user_pair
  FOR ALL USING (false) WITH CHECK (false);

-- ── user_tag_affinity ─────────────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "user_tag_affinity_read_own" ON public.user_tag_affinity
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "user_tag_affinity_insert_own" ON public.user_tag_affinity
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "user_tag_affinity_update_own" ON public.user_tag_affinity
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── domain_events ─────────────────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "domain_events_public_read" ON public.domain_events
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "domain_events_no_client_write" ON public.domain_events
  FOR ALL USING (false) WITH CHECK (false);

-- ── content_submissions ───────────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "content_submissions_read_authenticated" ON public.content_submissions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "content_submissions_no_client_write" ON public.content_submissions
  FOR ALL USING (false) WITH CHECK (false);

-- =============================================================================
-- STORAGE
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('place-gallery', 'place-gallery', true)
ON CONFLICT (id) DO NOTHING;
