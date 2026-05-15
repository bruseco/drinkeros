-- Add explicit restrictive RLS policy on whatsapp_welcome_queue
-- to document and enforce that only service_role can access this table
-- (which contains plaintext temporary passwords + PII).

ALTER TABLE public.whatsapp_welcome_queue ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing permissive policies (defensive)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_welcome_queue'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.whatsapp_welcome_queue', pol.policyname);
  END LOOP;
END $$;

-- Explicit deny-all policy for anon and authenticated roles.
-- service_role bypasses RLS, so edge functions continue to work.
CREATE POLICY "Deny all access to anon and authenticated"
ON public.whatsapp_welcome_queue
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);