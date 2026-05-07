-- user_collections: metadata de cada colección (ej. "Quiero ir", "Mis favoritos")
CREATE TABLE public.user_collections (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  emoji        text        NOT NULL DEFAULT '📍',
  color        text        NOT NULL DEFAULT 'bg-orange-100',
  is_default   boolean     NOT NULL DEFAULT false,
  is_public    boolean     NOT NULL DEFAULT false,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- collection_places: lugares guardados dentro de una colección
CREATE TABLE public.collection_places (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id     uuid        NOT NULL REFERENCES public.user_collections(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id          uuid        REFERENCES public.places(id) ON DELETE SET NULL,
  external_place_id text,
  place_name        text        NOT NULL,
  place_address     text,
  place_photo       text,
  note              text,
  saved_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collection_places_has_place CHECK (place_id IS NOT NULL OR external_place_id IS NOT NULL)
);

-- Índices
CREATE INDEX idx_user_collections_user_id      ON public.user_collections(user_id);
CREATE INDEX idx_collection_places_collection  ON public.collection_places(collection_id);
CREATE INDEX idx_collection_places_user        ON public.collection_places(user_id);
CREATE INDEX idx_collection_places_place       ON public.collection_places(place_id);

-- Únicos parciales
CREATE UNIQUE INDEX uq_collection_place          ON public.collection_places(collection_id, place_id)          WHERE place_id IS NOT NULL;
CREATE UNIQUE INDEX uq_collection_external_place ON public.collection_places(collection_id, external_place_id) WHERE external_place_id IS NOT NULL;

-- RLS
ALTER TABLE public.user_collections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_places ENABLE ROW LEVEL SECURITY;

-- Políticas user_collections
CREATE POLICY "owner select"   ON public.user_collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "public select"  ON public.user_collections FOR SELECT USING (is_public = true);
CREATE POLICY "owner insert"   ON public.user_collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update"   ON public.user_collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner delete"   ON public.user_collections FOR DELETE USING (auth.uid() = user_id);

-- Políticas collection_places
CREATE POLICY "owner select"          ON public.collection_places FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "public collection sel" ON public.collection_places FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_collections c WHERE c.id = collection_id AND c.is_public = true)
);
CREATE POLICY "owner insert"          ON public.collection_places FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update"          ON public.collection_places FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner delete"          ON public.collection_places FOR DELETE USING (auth.uid() = user_id);

-- Trigger: crear colecciones por defecto al registrar un nuevo usuario
CREATE OR REPLACE FUNCTION public.create_default_collections()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_collections (user_id, name, emoji, color, is_default, is_public, sort_order) VALUES
    (NEW.id, 'Quiero ir',     '📍', 'bg-sky-100',   true, true, 0),
    (NEW.id, 'Ya fui',        '✅', 'bg-green-100',  true, true, 1),
    (NEW.id, 'Mis favoritos', '❤️', 'bg-rose-100',   true, true, 2);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_created_collections
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_collections();
