-- Security hardening batch: revoke ebook file_url col, restrict zapi to super_admin,
-- drop tracking_settings.meta_capi_access_token, auto-purge welcome temp passwords

REVOKE SELECT (file_url) ON public.ebooks FROM anon, authenticated;

DROP POLICY IF EXISTS "Admins can manage zapi_connections" ON public.zapi_connections;
CREATE POLICY "Super admins can manage zapi_connections"
  ON public.zapi_connections
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE public.tracking_settings DROP COLUMN IF EXISTS meta_capi_access_token;

CREATE OR REPLACE FUNCTION public.purge_expired_welcome_passwords()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.whatsapp_welcome_queue
     SET temporary_password = NULL
   WHERE temporary_password IS NOT NULL
     AND created_at < now() - interval '24 hours';
$$;

SELECT public.purge_expired_welcome_passwords();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-welcome-passwords') THEN
      PERFORM cron.unschedule('purge-welcome-passwords');
    END IF;
    PERFORM cron.schedule(
      'purge-welcome-passwords',
      '0 * * * *',
      'SELECT public.purge_expired_welcome_passwords();'
    );
  END IF;
END $$;
