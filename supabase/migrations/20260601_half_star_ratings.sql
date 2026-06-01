-- 20260601_half_star_ratings.sql
-- Soporte para medias estrellas (estilo Letterboxd): 1, 1.5, 2, 2.5 … 5.
-- Las columnas de rating que hoy son INTEGER redondean los .5 al guardar, por lo
-- que se amplían a NUMERIC(2,1). Idempotente: sólo altera si aún es entera.
--
-- Tablas afectadas:
--   posts.rating               (rating individual de cada reseña)
--   content_submissions.rating (registro analítico, tenía CHECK 1..5)
--   menu_items.rating          (aporte de comunidad)
--
-- COMPLICACIÓN: `posts.rating` (y posiblemente otras) es referenciada por vistas
-- (p. ej. `posts_feed`). Postgres no permite `ALTER COLUMN ... TYPE` mientras una
-- vista depende de la columna. Por eso este script, de forma automática:
--   1. Detecta TODAS las vistas que dependen de esas columnas `rating`
--      (directa o indirectamente).
--   2. Guarda su definición, permisos (GRANT) y opciones (p. ej. security_invoker).
--   3. Suelta las vistas, altera las columnas y recrea las vistas idénticas,
--      restaurando permisos y opciones.
-- Todo corre dentro de un único bloque (transacción): si algo falla, no deja
-- nada a medias.
--
-- places.internal_rating ya es numeric(3,2) y lo mantiene el trigger
-- trg_refresh_place_rating; no requiere cambios.

DO $$
DECLARE
  rec record;
BEGIN
  -- Nada que hacer si ninguna columna objetivo sigue siendo entera.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'posts'               AND column_name = 'rating')
        OR (table_name = 'content_submissions' AND column_name = 'rating')
        OR (table_name = 'menu_items'          AND column_name = 'rating'))
      AND data_type IN ('integer', 'smallint', 'bigint')
  ) THEN
    RAISE NOTICE 'rating ya es numérico en todas las tablas; nada que alterar.';
    RETURN;
  END IF;

  -- 1. Vistas dependientes (recursivo) de la columna `rating` de las 3 tablas.
  CREATE TEMP TABLE _dep_views ON COMMIT DROP AS
  WITH RECURSIVE deps AS (
    -- Base: vistas que referencian directamente la columna `rating`.
    SELECT DISTINCT r.ev_class AS view_oid, 1 AS depth
    FROM pg_depend d
    JOIN pg_rewrite r   ON r.oid = d.objid
    JOIN pg_class    c  ON c.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = c.oid
                       AND a.attname  = 'rating'
                       AND a.attnum   = d.refobjsubid
    WHERE c.relname IN ('posts', 'content_submissions', 'menu_items')
      AND c.relnamespace = 'public'::regnamespace
      AND r.ev_class <> d.refobjid
    UNION ALL
    -- Recursivo: vistas que dependen de las vistas ya capturadas.
    SELECT DISTINCT r.ev_class, deps.depth + 1
    FROM deps
    JOIN pg_depend  d ON d.refobjid = deps.view_oid
    JOIN pg_rewrite r ON r.oid = d.objid
    WHERE r.ev_class <> d.refobjid
      AND deps.depth < 20
  )
  SELECT deps.view_oid,
         n.nspname AS schema_name,
         c.relname AS view_name,
         quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS full_name,
         max(deps.depth) AS depth,
         pg_get_viewdef(deps.view_oid) AS def,
         c.reloptions AS reloptions
  FROM deps
  JOIN pg_class     c ON c.oid = deps.view_oid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'v'  -- sólo vistas normales
  GROUP BY deps.view_oid, n.nspname, c.relname, c.reloptions;

  -- 2. Permisos (GRANT) de esas vistas, para restaurarlos luego.
  CREATE TEMP TABLE _dep_grants ON COMMIT DROP AS
  SELECT v.full_name, g.grantee, g.privilege_type
  FROM information_schema.role_table_grants g
  JOIN _dep_views v ON v.schema_name = g.table_schema
                   AND v.view_name   = g.table_name;

  -- 3. Soltar las vistas (las más profundas primero; CASCADE por seguridad).
  FOR rec IN SELECT full_name FROM _dep_views ORDER BY depth DESC LOOP
    EXECUTE 'DROP VIEW IF EXISTS ' || rec.full_name || ' CASCADE';
  END LOOP;

  -- 4. Alterar las columnas a numeric(2,1) (cada una guardada por si ya lo era).
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='posts'
               AND column_name='rating' AND data_type IN ('integer','smallint','bigint')) THEN
    ALTER TABLE posts ALTER COLUMN rating TYPE numeric(2,1) USING rating::numeric(2,1);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='content_submissions'
               AND column_name='rating' AND data_type IN ('integer','smallint','bigint')) THEN
    ALTER TABLE content_submissions ALTER COLUMN rating TYPE numeric(2,1) USING rating::numeric(2,1);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='menu_items'
               AND column_name='rating' AND data_type IN ('integer','smallint','bigint')) THEN
    ALTER TABLE menu_items ALTER COLUMN rating TYPE numeric(2,1) USING rating::numeric(2,1);
  END IF;

  -- 5. Recrear las vistas (las menos profundas primero), con sus opciones.
  FOR rec IN SELECT full_name, def, reloptions FROM _dep_views ORDER BY depth ASC LOOP
    EXECUTE 'CREATE VIEW ' || rec.full_name || ' AS ' || rec.def;
    IF rec.reloptions IS NOT NULL THEN
      EXECUTE 'ALTER VIEW ' || rec.full_name || ' SET (' || array_to_string(rec.reloptions, ', ') || ')';
    END IF;
  END LOOP;

  -- 6. Restaurar permisos.
  FOR rec IN SELECT full_name, grantee, privilege_type FROM _dep_grants LOOP
    EXECUTE 'GRANT ' || rec.privilege_type || ' ON ' || rec.full_name || ' TO ' ||
            CASE WHEN rec.grantee = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(rec.grantee) END;
  END LOOP;
END $$;

-- Garantizar que sólo se acepten múltiplos de 0.5 dentro de 0..5.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='posts' AND column_name='rating')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_rating_half_step') THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_rating_half_step
      CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5 AND (rating * 2) = floor(rating * 2)));
  END IF;
END $$;
