
-- Categories for exclusive content
CREATE TABLE public.exclusive_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  cover_image_url text,
  feature_key text NOT NULL UNIQUE DEFAULT 'receitas',
  display_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.exclusive_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active exclusive_categories"
  ON public.exclusive_categories FOR SELECT
  USING (is_active = true OR is_admin(auth.uid()));

CREATE POLICY "Editors can manage exclusive_categories"
  ON public.exclusive_categories FOR ALL
  USING (can_edit(auth.uid()));

-- Add category reference to exclusive_posts
ALTER TABLE public.exclusive_posts ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.exclusive_categories(id);

-- Seed the first category: Receitas
INSERT INTO public.exclusive_categories (name, slug, feature_key, description)
VALUES ('Receitas', 'receitas', 'receitas', 'Receitas exclusivas de drinks');
