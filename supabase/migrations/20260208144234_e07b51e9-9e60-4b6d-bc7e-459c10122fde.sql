
-- Create courses table
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  cover_image_url text,
  hotmart_product_code text,
  woocommerce_product_id text,
  is_active boolean NOT NULL DEFAULT true,
  is_free boolean NOT NULL DEFAULT false,
  is_available_for_sale boolean NOT NULL DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create course_packages junction table
CREATE TABLE public.course_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(course_id, package_id)
);

-- Create user_courses table
CREATE TABLE public.user_courses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id),
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Enable RLS on all tables
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;

-- RLS policies for courses
CREATE POLICY "Anyone can view active courses"
ON public.courses
FOR SELECT
USING ((is_active = true) OR is_admin(auth.uid()));

CREATE POLICY "Editors can manage courses"
ON public.courses
FOR ALL
USING (can_edit(auth.uid()));

-- RLS policies for course_packages
CREATE POLICY "Anyone can view course_packages"
ON public.course_packages
FOR SELECT
USING (true);

CREATE POLICY "Editors can manage course_packages"
ON public.course_packages
FOR ALL
USING (can_edit(auth.uid()));

-- RLS policies for user_courses
CREATE POLICY "Users can view own courses"
ON public.user_courses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage user_courses"
ON public.user_courses
FOR ALL
USING (is_admin(auth.uid()));

-- Trigger for updated_at on courses
CREATE TRIGGER update_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
