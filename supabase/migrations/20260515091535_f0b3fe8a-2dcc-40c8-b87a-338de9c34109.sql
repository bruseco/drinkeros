
-- 1) Restrict certificates table: remove blanket public read, allow only owner + admin
DROP POLICY IF EXISTS "Anyone can validate certificates by code" ON public.certificates;
DROP POLICY IF EXISTS "Public can validate certificates" ON public.certificates;

-- Owner can read their own certificates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='certificates' AND policyname='Users can read own certificates'
  ) THEN
    CREATE POLICY "Users can read own certificates"
      ON public.certificates FOR SELECT
      USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
  END IF;
END $$;

-- 2) Restrict tracking_settings: only authenticated reads (Facebook Pixel ID is mildly sensitive but admin-managed)
DROP POLICY IF EXISTS "Tracking settings are viewable by everyone" ON public.tracking_settings;
DROP POLICY IF EXISTS "Anyone can view tracking settings" ON public.tracking_settings;
DROP POLICY IF EXISTS "Public can view tracking settings" ON public.tracking_settings;

CREATE POLICY "Public can view tracking settings"
  ON public.tracking_settings FOR SELECT
  USING (true);
-- Note: keeping public read because Facebook Pixel is loaded by anonymous landing page visitors.
-- Pixel ID is non-sensitive — it's exposed in the rendered HTML once injected.

-- 3) Remove 'viewer' from is_admin (privilege escalation risk)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'editor')
  )
$function$;

-- New helper for read-only viewer access (separate from is_admin)
CREATE OR REPLACE FUNCTION public.has_viewer_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'editor', 'viewer')
  )
$function$;

-- 4) Server-side certificate validation function (returns minimal data, requires both code + cpf)
CREATE OR REPLACE FUNCTION public.validate_certificate(_code text, _cpf text)
RETURNS TABLE(
  reference_name text,
  certificate_type text,
  completed_at timestamptz,
  verification_code text,
  student_name text,
  workload_seconds integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.reference_name, c.certificate_type, c.completed_at,
         c.verification_code, c.student_name, c.workload_seconds
  FROM public.certificates c
  WHERE c.verification_code = upper(trim(_code))
    AND regexp_replace(coalesce(c.student_cpf, ''), '\D', '', 'g')
        = regexp_replace(coalesce(_cpf, ''), '\D', '', 'g')
  LIMIT 1;
$function$;

-- Allow anon and authenticated to call the validation function (returns minimal, no CPF)
GRANT EXECUTE ON FUNCTION public.validate_certificate(text, text) TO anon, authenticated;
