
-- 1. Ebooks: hide file_url from clients (anon + authenticated)
REVOKE SELECT (file_url) ON public.ebooks FROM anon, authenticated;

-- Admin-only RPC to retrieve file_url for editing
CREATE OR REPLACE FUNCTION public.admin_get_ebook_file_url(_ebook_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT file_url
  FROM public.ebooks
  WHERE id = _ebook_id
    AND public.is_admin(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_ebook_file_url(uuid) TO authenticated;

-- 2. recipe_materials: restrict SELECT to users who own the package (or admins)
DROP POLICY IF EXISTS "Authenticated users can view recipe_materials" ON public.recipe_materials;

CREATE POLICY "Users view materials of accessible recipes"
ON public.recipe_materials
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.recipes r
    JOIN public.recipe_packages rp ON rp.recipe_id = r.id
    LEFT JOIN public.user_packages up
      ON up.package_id = rp.package_id AND up.user_id = auth.uid()
    LEFT JOIN public.packages p ON p.id = rp.package_id
    WHERE r.id = recipe_materials.recipe_id
      AND r.status = 'published'
      AND (up.user_id IS NOT NULL OR p.is_free = true)
  )
);

-- 3. tracking_settings: explicit restrictive deny for anon (defense-in-depth)
DROP POLICY IF EXISTS "Deny anonymous access to tracking_settings" ON public.tracking_settings;
CREATE POLICY "Deny anonymous access to tracking_settings"
ON public.tracking_settings
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Also explicitly revoke column-level access to the sensitive CAPI token from anon
REVOKE SELECT (meta_capi_access_token) ON public.tracking_settings FROM anon;
