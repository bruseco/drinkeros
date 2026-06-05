
-- Fix 1: Revoke SELECT on ebooks.file_url from anon and authenticated.
-- The 'get-signed-file-url' edge function (service_role) remains the only path.
REVOKE SELECT (file_url) ON public.ebooks FROM anon, authenticated;

-- Fix 2: Drop the unused/dangerous is_admin column on profiles.
-- Authorization is correctly enforced via public.user_roles + has_role/is_admin RPC.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_admin;
