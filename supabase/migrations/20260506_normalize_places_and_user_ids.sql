-- =============================================================================
-- MIGRACIÓN: Normalizar flags booleanos de places + tipos de user_id
-- Fecha: 2026-05-06
--
-- Qué hace:
--   1. Elimina objetos muertos (funciones/vistas que referencian tablas
--      que no existen: user_reviews, user_preferences, posts, profiles)
--   2. Backfill de restrictions_supported[] desde los 7 flags dietéticos
--   3. Crea amenities[] y backfill desde los 9 flags de features del local
--   4. Elimina los 16 flags booleanos + opening_now (estado transitorio)
--   5. Agrega auth_user_id uuid FK a content_submissions y domain_events
--   6. Elimina la tabla usuarios (0 rows, sin FK a auth.users, huérfana)
-- =============================================================================

-- ── 1. Eliminar objetos muertos ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_refresh_place_rating ON public.user_reviews;
DROP FUNCTION IF EXISTS public.refresh_place_rating();
DROP FUNCTION IF EXISTS public.place_match_score(uuid, uuid);
DROP VIEW IF EXISTS public.posts_feed;
DROP VIEW IF EXISTS public.user_leaderboard;
DROP TABLE IF EXISTS public.usuarios;

-- ── 2. Backfill restrictions_supported[] desde flags dietéticos ───────────────
-- Conserva los valores ya existentes en el array y agrega los que falten.

UPDATE public.places
SET restrictions_supported = (
  SELECT COALESCE(array_agg(DISTINCT r), '{}')
  FROM unnest(
    COALESCE(restrictions_supported, '{}') ||
    CASE WHEN is_vegetarian_friendly THEN ARRAY['vegetariano'] ELSE '{}' END ||
    CASE WHEN is_vegan_friendly       THEN ARRAY['vegano']      ELSE '{}' END ||
    CASE WHEN is_gluten_free_friendly THEN ARRAY['sin_gluten']  ELSE '{}' END ||
    CASE WHEN is_halal                THEN ARRAY['halal']       ELSE '{}' END ||
    CASE WHEN is_kosher               THEN ARRAY['kosher']      ELSE '{}' END ||
    CASE WHEN is_keto_friendly        THEN ARRAY['keto']        ELSE '{}' END ||
    CASE WHEN is_lactose_free         THEN ARRAY['sin_lactosa'] ELSE '{}' END
  ) r
);

-- ── 3. Crear amenities[] y backfill desde flags de features ──────────────────

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_places_amenities
  ON public.places USING gin(amenities);

UPDATE public.places
SET amenities = (
  SELECT COALESCE(array_agg(DISTINCT a), '{}')
  FROM unnest(
    CASE WHEN has_delivery         THEN ARRAY['delivery']        ELSE '{}' END ||
    CASE WHEN has_takeout          THEN ARRAY['takeout']         ELSE '{}' END ||
    CASE WHEN has_outdoor_seating  THEN ARRAY['outdoor_seating'] ELSE '{}' END ||
    CASE WHEN has_wifi             THEN ARRAY['wifi']            ELSE '{}' END ||
    CASE WHEN has_parking          THEN ARRAY['parking']         ELSE '{}' END ||
    CASE WHEN accepts_reservations THEN ARRAY['reservations']    ELSE '{}' END ||
    CASE WHEN is_family_friendly   THEN ARRAY['family_friendly'] ELSE '{}' END ||
    CASE WHEN is_pet_friendly      THEN ARRAY['pet_friendly']    ELSE '{}' END ||
    CASE WHEN is_open_late         THEN ARRAY['open_late']       ELSE '{}' END
  ) a
);

-- ── 4. Eliminar los 16 flags booleanos y opening_now ─────────────────────────

ALTER TABLE public.places
  DROP COLUMN IF EXISTS is_vegetarian_friendly,
  DROP COLUMN IF EXISTS is_vegan_friendly,
  DROP COLUMN IF EXISTS is_gluten_free_friendly,
  DROP COLUMN IF EXISTS is_halal,
  DROP COLUMN IF EXISTS is_kosher,
  DROP COLUMN IF EXISTS is_keto_friendly,
  DROP COLUMN IF EXISTS is_lactose_free,
  DROP COLUMN IF EXISTS has_delivery,
  DROP COLUMN IF EXISTS has_takeout,
  DROP COLUMN IF EXISTS has_outdoor_seating,
  DROP COLUMN IF EXISTS has_wifi,
  DROP COLUMN IF EXISTS has_parking,
  DROP COLUMN IF EXISTS accepts_reservations,
  DROP COLUMN IF EXISTS is_family_friendly,
  DROP COLUMN IF EXISTS is_pet_friendly,
  DROP COLUMN IF EXISTS is_open_late,
  DROP COLUMN IF EXISTS opening_now;

-- ── 5. content_submissions: agregar auth_user_id uuid con FK ─────────────────
-- user_id text se conserva para soporte de usuarios anónimos (localStorage ID).
-- auth_user_id uuid se usa cuando el usuario sí está autenticado.

ALTER TABLE public.content_submissions
  ADD COLUMN IF NOT EXISTS auth_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- Migrar filas existentes cuyo user_id ya era un UUID válido
UPDATE public.content_submissions
SET auth_user_id = user_id::uuid
WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

CREATE INDEX IF NOT EXISTS idx_content_submissions_auth_user_id
  ON public.content_submissions(auth_user_id);

-- ── 6. domain_events: agregar auth_user_id uuid con FK ───────────────────────

ALTER TABLE public.domain_events
  ADD COLUMN IF NOT EXISTS auth_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.domain_events
SET auth_user_id = user_id::uuid
WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

CREATE INDEX IF NOT EXISTS idx_domain_events_auth_user_id
  ON public.domain_events(auth_user_id);
