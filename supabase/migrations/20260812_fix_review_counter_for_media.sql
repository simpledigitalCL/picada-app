-- Una foto/video puede acompañar una reseña; la fuente de verdad para el
-- promedio y contador es que el post tenga rating, no su tipo de presentación.
CREATE OR REPLACE FUNCTION public.refresh_place_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_place_id uuid;
BEGIN
  target_place_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.place_id ELSE NEW.place_id END;

  IF target_place_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.places
  SET
    internal_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.posts
      WHERE place_id = target_place_id
        AND rating IS NOT NULL
        AND is_incognito = false
    ),
    internal_rating_count = (
      SELECT COUNT(*)
      FROM public.posts
      WHERE place_id = target_place_id
        AND rating IS NOT NULL
        AND is_incognito = false
    )
  WHERE id = target_place_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Repara todos los contadores, incluidos los lugares afectados antes de este cambio.
UPDATE public.places p
SET
  internal_rating = ratings.avg_rating,
  internal_rating_count = ratings.count
FROM (
  SELECT
    p2.id,
    ROUND(AVG(post.rating)::numeric, 2) AS avg_rating,
    COUNT(post.id)::int AS count
  FROM public.places p2
  LEFT JOIN public.posts post
    ON post.place_id = p2.id
   AND post.rating IS NOT NULL
   AND post.is_incognito = false
  GROUP BY p2.id
) ratings
WHERE p.id = ratings.id;
