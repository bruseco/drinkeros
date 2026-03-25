
-- Table: combos
CREATE TABLE public.combos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  cover_image_url text,
  woocommerce_product_id text,
  hotmart_product_code text,
  is_active boolean NOT NULL DEFAULT true,
  is_free boolean NOT NULL DEFAULT false,
  is_available_for_sale boolean NOT NULL DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active combos" ON public.combos
  FOR SELECT USING ((is_active = true) OR is_admin(auth.uid()));

CREATE POLICY "Editors can manage combos" ON public.combos
  FOR ALL USING (can_edit(auth.uid()));

CREATE TRIGGER update_combos_updated_at
  BEFORE UPDATE ON public.combos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: combo_courses
CREATE TABLE public.combo_courses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(combo_id, course_id)
);

ALTER TABLE public.combo_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view combo_courses" ON public.combo_courses
  FOR SELECT USING (true);

CREATE POLICY "Editors can manage combo_courses" ON public.combo_courses
  FOR ALL USING (can_edit(auth.uid()));

-- Table: user_combos
CREATE TABLE public.user_combos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, combo_id)
);

ALTER TABLE public.user_combos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user_combos" ON public.user_combos
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own combos" ON public.user_combos
  FOR SELECT USING (auth.uid() = user_id);
