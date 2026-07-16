-- Restrict club member gating to actual paying/lifetime members.
CREATE OR REPLACE FUNCTION public.is_club_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.is_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_lifetime_access WHERE user_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.user_plans
        WHERE user_id = _user_id
          AND plan = 'vip'
          AND (expires_at IS NULL OR expires_at > now())
      )
      OR EXISTS (
        SELECT 1 FROM public.user_exclusive_access
        WHERE user_id = _user_id
          AND feature = 'receitas'
          AND (expires_at IS NULL OR expires_at > now())
      )
    )
$$;

-- Prevent anon/authenticated from selecting ebooks.file_url directly.
-- Downloads must go through the get-signed-file-url edge function which
-- validates purchase/access before signing a URL.
REVOKE SELECT (file_url) ON public.ebooks FROM anon;
REVOKE SELECT (file_url) ON public.ebooks FROM authenticated;

-- Explicitly grant column-level SELECT on all remaining columns so client
-- queries continue to work as before (metadata only).
DO $$
DECLARE
  col_list text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO col_list
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'ebooks'
    AND column_name <> 'file_url';

  EXECUTE format('GRANT SELECT (%s) ON public.ebooks TO anon', col_list);
  EXECUTE format('GRANT SELECT (%s) ON public.ebooks TO authenticated', col_list);
END $$;