create or replace function public.get_personalized_recommendations(
  p_user_id uuid,
  p_limit int default 5,
  p_city text default null
)
returns table (
  place_id uuid,
  name text,
  address text,
  city text,
  rating numeric,
  picada_score int,
  maps_url text,
  photo_url text,
  score numeric,
  reason text
)
language sql
stable
as $$
with params as (
  select
    greatest(1, least(coalesce(p_limit, 5), 20)) as lim,
    greatest(1, ceil(greatest(1, least(coalesce(p_limit, 5), 20)) * 0.2)::int) as ser_lim
),
user_aff as (
  select
    uta.tag_slug,
    (uta.weight * (1.0 / (1.0 + (extract(day from now() - uta.updated_at) * 0.05))))::numeric as eff_weight
  from public.user_tag_affinity uta
  where uta.user_id = p_user_id
  order by eff_weight desc
  limit 10
),
candidate_places as (
  select
    p.id,
    p.name,
    p.address,
    p.city,
    p.rating,
    p.picada_score,
    p.maps_url,
    case
      when jsonb_typeof(p.gallery) = 'array' and jsonb_array_length(p.gallery) > 0
        then p.gallery->>0
      else null
    end as photo_url,
    sum(
      ua.eff_weight *
      coalesce((seed.tag->>'confidence_score')::numeric, 0.5)
    ) as base_score
  from public.places p
  join lateral jsonb_array_elements(coalesce(p.tagging_meta->'automated_seed'->'tags', '[]'::jsonb)) as seed(tag) on true
  join user_aff ua on lower(seed.tag->>'slug') = lower(ua.tag_slug)
  where (p.is_active is null or p.is_active = true)
    and (p_city is null or p_city = '' or p.city ilike ('%' || p_city || '%'))
    and not exists (
      select 1
      from public.user_reviews ur
      where ur.user_id = p_user_id
        and ur.place_id = p.id
    )
  group by p.id, p.name, p.address, p.city, p.rating, p.picada_score, p.maps_url, p.gallery
),
core_ranked as (
  select
    cp.id as place_id,
    cp.name,
    cp.address,
    cp.city,
    cp.rating,
    cp.picada_score,
    cp.maps_url,
    cp.photo_url,
    (
      cp.base_score
      * greatest(1, coalesce(cp.rating, 0))
      * case when p_city is not null and p_city <> '' and cp.city ilike ('%' || p_city || '%') then 1.10 else 1.00 end
    )::numeric as score,
    'affinity'::text as reason
  from candidate_places cp
  order by score desc
  limit ((select lim from params) - (select ser_lim from params))
),
serendipia as (
  select
    p.id as place_id,
    p.name,
    p.address,
    p.city,
    p.rating,
    p.picada_score,
    p.maps_url,
    case
      when jsonb_typeof(p.gallery) = 'array' and jsonb_array_length(p.gallery) > 0
        then p.gallery->>0
      else null
    end as photo_url,
    (greatest(1, coalesce(p.rating, 0)) * 8 + greatest(0, coalesce(p.picada_score, 0)) * 0.2)::numeric as score,
    'serendipia'::text as reason
  from public.places p
  where (p.is_active is null or p.is_active = true)
    and (p_city is null or p_city = '' or p.city ilike ('%' || p_city || '%'))
    and p.rating >= 4
    and not exists (select 1 from core_ranked c where c.place_id = p.id)
    and not exists (
      select 1
      from public.user_reviews ur
      where ur.user_id = p_user_id
        and ur.place_id = p.id
    )
  order by random()
  limit (select ser_lim from params)
)
select * from core_ranked
union all
select * from serendipia
order by score desc
limit (select lim from params);
$$;

