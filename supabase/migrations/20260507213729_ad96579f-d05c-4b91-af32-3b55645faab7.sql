
CREATE TABLE public.tracking_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facebook_pixel_id TEXT,
  facebook_pixel_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tracking settings"
ON public.tracking_settings FOR SELECT
USING (true);

CREATE POLICY "Super admins can insert tracking settings"
ON public.tracking_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update tracking settings"
ON public.tracking_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_tracking_settings_updated_at
BEFORE UPDATE ON public.tracking_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.tracking_settings (facebook_pixel_enabled) VALUES (false);
