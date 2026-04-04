
-- Create user_ebooks table
CREATE TABLE public.user_ebooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ebook_id UUID NOT NULL REFERENCES public.ebooks(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, ebook_id)
);

ALTER TABLE public.user_ebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ebooks"
  ON public.user_ebooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage user_ebooks"
  ON public.user_ebooks FOR ALL
  USING (is_admin(auth.uid()));

-- Propagate combo purchase to ebooks
CREATE OR REPLACE FUNCTION public.propagate_user_combo_ebook_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_ebooks (user_id, ebook_id)
  SELECT NEW.user_id, ce.ebook_id
  FROM public.combo_ebooks ce
  WHERE ce.combo_id = NEW.combo_id
  ON CONFLICT (user_id, ebook_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_propagate_combo_ebook_access
  AFTER INSERT ON public.user_combos
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_user_combo_ebook_access();

-- When ebook added to combo, propagate to existing combo owners
CREATE OR REPLACE FUNCTION public.propagate_combo_ebook_addition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_ebooks (user_id, ebook_id)
  SELECT uc.user_id, NEW.ebook_id
  FROM public.user_combos uc
  WHERE uc.combo_id = NEW.combo_id
  ON CONFLICT (user_id, ebook_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_propagate_combo_ebook_addition
  AFTER INSERT ON public.combo_ebooks
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_combo_ebook_addition();
