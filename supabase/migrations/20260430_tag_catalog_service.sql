-- Dimensión de etiquetas para servicios/infra del local (service_*)
alter table public.tag_catalog drop constraint if exists tag_catalog_category_check;

alter table public.tag_catalog
  add constraint tag_catalog_category_check
  check (category in ('food', 'dress', 'ambience', 'local', 'service'));
