-- Clasificación automática inicial (seed) metadatos + comunidad (confirmar/rechazar/manual).
alter table public.places
  add column if not exists tagging_meta jsonb default '{}'::jsonb;

comment on column public.places.tagging_meta is 'Seeds automatizadas (confidence, slug), overrides comunitarias; no borrar manual_slug al re-etiquetar bot.';

create index if not exists idx_places_tagging_seed
  on public.places ((tagging_meta -> 'automated_seed' ->> 'generated_at'))
  where (tagging_meta -> 'automated_seed') is not null;
