ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS banner_image_url text,
  ADD COLUMN IF NOT EXISTS banner_link_url text;