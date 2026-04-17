
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.exclusive_posts ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.slugify(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM regexp_replace(
    lower(public.unaccent(coalesce(v, ''))),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

DO $$
DECLARE
  r record;
  base_slug text;
  final_slug text;
  counter int;
BEGIN
  FOR r IN SELECT id, title FROM public.exclusive_posts WHERE slug IS NULL OR slug = '' LOOP
    base_slug := public.slugify(r.title);
    IF base_slug = '' THEN base_slug := 'receita'; END IF;
    final_slug := base_slug;
    counter := 2;
    WHILE EXISTS (SELECT 1 FROM public.exclusive_posts WHERE slug = final_slug AND id <> r.id) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    UPDATE public.exclusive_posts SET slug = final_slug WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS exclusive_posts_slug_unique ON public.exclusive_posts(slug) WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_exclusive_post_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.slugify(NEW.title);
    IF base_slug = '' THEN base_slug := 'receita'; END IF;
    final_slug := base_slug;
    counter := 2;
    WHILE EXISTS (SELECT 1 FROM public.exclusive_posts WHERE slug = final_slug AND id <> NEW.id) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_exclusive_post_slug ON public.exclusive_posts;
CREATE TRIGGER trg_set_exclusive_post_slug
BEFORE INSERT OR UPDATE OF title, slug ON public.exclusive_posts
FOR EACH ROW EXECUTE FUNCTION public.set_exclusive_post_slug();
