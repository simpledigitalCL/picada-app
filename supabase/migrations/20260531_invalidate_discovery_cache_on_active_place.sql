-- =============================================================================
-- MIGRACIÓN: Invalidar daily snapshot de discovery cache cuando un place pasa a active
-- Fecha: 2026-05-31
-- =============================================================================
--
-- Contexto:
--   `app/api/restaurants/discover/route.ts` lee `place_discovery_cache` con la
--   clave `daily::<location>::<fecha>` ANTES de consultar la tabla `places`.
--   Si existe ese snapshot (TTL 26h), las nuevas picadas activas no aparecen
--   en discover, mapa, ni buscador de reseñas hasta que expire.
--
-- Qué hace:
--   Cuando un place se inserta con status='active' o pasa a 'active' vía UPDATE,
--   borra TODAS las filas `daily::%` del cache para forzar regeneración.
--
-- Por qué borra todo `daily::%` y no solo la zona:
--   Volumen actual bajo (pocos usuarios activos). Cuando escale, afinar para
--   borrar solo `daily::<commune-normalizada>::%`.
--
-- Trade-off:
--   La siguiente petición a /api/restaurants/discover hará la ruta lenta
--   (~5-8s) porque el snapshot fue borrado. Aceptable mientras el tráfico
--   sea bajo.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.invalidate_discovery_cache_on_active_place()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'active'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active')
  THEN
    DELETE FROM public.place_discovery_cache
    WHERE location_key LIKE 'daily::%';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_discovery_cache_on_active_place ON public.places;

CREATE TRIGGER trg_invalidate_discovery_cache_on_active_place
AFTER INSERT OR UPDATE OF status ON public.places
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_discovery_cache_on_active_place();
