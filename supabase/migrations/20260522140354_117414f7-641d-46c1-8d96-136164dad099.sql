-- Add CAPI access token and test event code to tracking settings
ALTER TABLE public.tracking_settings
  ADD COLUMN IF NOT EXISTS meta_capi_access_token text,
  ADD COLUMN IF NOT EXISTS meta_test_event_code text;

-- Restrict direct SELECT (token is sensitive). Replace public read policies.
DROP POLICY IF EXISTS "Anyone can read tracking settings" ON public.tracking_settings;
DROP POLICY IF EXISTS "Public can view tracking settings" ON public.tracking_settings;

CREATE POLICY "Super admins can read tracking settings"
ON public.tracking_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Public-safe RPC that exposes only pixel id + enabled (no token)
CREATE OR REPLACE FUNCTION public.get_public_tracking_settings()
RETURNS TABLE (facebook_pixel_id text, facebook_pixel_enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT facebook_pixel_id, facebook_pixel_enabled
  FROM public.tracking_settings
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tracking_settings() TO anon, authenticated;