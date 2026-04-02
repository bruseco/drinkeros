
CREATE TABLE public.exclusive_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT,
  cover_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exclusive_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published exclusive posts" ON public.exclusive_posts
  FOR SELECT USING (is_published = true OR is_admin(auth.uid()));

CREATE POLICY "Editors can manage exclusive posts" ON public.exclusive_posts
  FOR ALL USING (can_edit(auth.uid()));

CREATE TRIGGER update_exclusive_posts_updated_at
  BEFORE UPDATE ON public.exclusive_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
