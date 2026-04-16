
CREATE TABLE public.certificate_layout_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_x integer NOT NULL DEFAULT 1674,
  name_y integer NOT NULL DEFAULT 1334,
  date_x integer NOT NULL DEFAULT 897,
  date_y integer NOT NULL DEFAULT 1886,
  name_font_size integer NOT NULL DEFAULT 28,
  date_font_size integer NOT NULL DEFAULT 14,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.certificate_layout_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view certificate layout"
ON public.certificate_layout_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update certificate layout"
ON public.certificate_layout_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.certificate_layout_settings (name_x, name_y, date_x, date_y, name_font_size, date_font_size)
VALUES (1674, 1334, 897, 1886, 28, 14);
