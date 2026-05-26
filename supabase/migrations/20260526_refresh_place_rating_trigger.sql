-- =============================================================================
-- MIGRACIÓN: Trigger para actualizar internal_rating e internal_rating_count
-- Fecha: 2026-05-26
--
-- Qué hace:
--   Recrea la función refresh_place_rating() y el trigger
--   trg_refresh_place_rating sobre la tabla posts (antes estaba en
--   user_reviews, que fue eliminada en 20260506).
--
--   Recalcula internal_rating (promedio) e internal_rating_count (conteo)
--   en places cada vez que se inserta, actualiza o elimina un post con
--   rating != null, type = 'review' e is_incognito = false.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refresh_place_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_place_id uuid;
BEGIN
  -- Determinar el place_id afectado según la operación
  IF TG_OP = 'DELETE' THEN
    target_place_id := OLD.place_id;
  ELSE
    target_place_id := NEW.place_id;
  END IF;

  -- Si no hay place_id asociado, no hay nada que actualizar
  IF target_place_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.places
  SET
    internal_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.posts
      WHERE place_id       = target_place_id
        AND rating         IS NOT NULL
        AND is_incognito   = false
        AND type           = 'review'
    ),
    internal_rating_count = (
      SELECT COUNT(*)
      FROM public.posts
      WHERE place_id       = target_place_id
        AND rating         IS NOT NULL
        AND is_incognito   = false
        AND type           = 'review'
    )
  WHERE id = target_place_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Trigger en tabla posts (usada por la API de la app) ─────────────────────
-- Nota: posts_feed es una vista — no aplica trigger AFTER en vistas.

DROP TRIGGER IF EXISTS trg_refresh_place_rating ON public.posts;

CREATE TRIGGER trg_refresh_place_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.refresh_place_rating();

-- ── Backfill: recalcular ratings para todos los places que ya tienen posts ────

UPDATE public.places p
SET
  internal_rating = sub.avg_rating,
  internal_rating_count = sub.cnt
FROM (
  SELECT
    place_id,
    ROUND(AVG(rating)::numeric, 2) AS avg_rating,
    COUNT(*)                        AS cnt
  FROM public.posts
  WHERE rating       IS NOT NULL
    AND is_incognito = false
    AND type         = 'review'
  GROUP BY place_id
) sub
WHERE p.id = sub.place_id;
