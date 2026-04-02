
-- Create ebooks table
CREATE TABLE public.ebooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  file_url TEXT,
  price NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active ebooks" ON public.ebooks
  FOR SELECT USING (is_active = true OR is_admin(auth.uid()));

CREATE POLICY "Editors can manage ebooks" ON public.ebooks
  FOR ALL USING (can_edit(auth.uid()));

CREATE TRIGGER update_ebooks_updated_at
  BEFORE UPDATE ON public.ebooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add price to combos (now "produtos")
ALTER TABLE public.combos ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);

-- Create combo_ebooks junction table
CREATE TABLE public.combo_ebooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combo_id UUID NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  ebook_id UUID NOT NULL REFERENCES public.ebooks(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(combo_id, ebook_id)
);

ALTER TABLE public.combo_ebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view combo_ebooks" ON public.combo_ebooks
  FOR SELECT USING (true);

CREATE POLICY "Editors can manage combo_ebooks" ON public.combo_ebooks
  FOR ALL USING (can_edit(auth.uid()));

-- Create storage bucket for ebook PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('ebook-files', 'ebook-files', true);

CREATE POLICY "Anyone can read ebook files" ON storage.objects
  FOR SELECT USING (bucket_id = 'ebook-files');

CREATE POLICY "Editors can upload ebook files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'ebook-files');

CREATE POLICY "Editors can update ebook files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'ebook-files');

CREATE POLICY "Editors can delete ebook files" ON storage.objects
  FOR DELETE USING (bucket_id = 'ebook-files');
