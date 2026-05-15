-- 1) Make buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('ebook-files', 'lesson-materials');

-- 2) Drop public-read policies
DROP POLICY IF EXISTS "Anyone can read ebook files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view lesson materials" ON storage.objects;

-- 3) Allow editors/admins to read these buckets (for admin previews/management)
CREATE POLICY "Editors can read ebook files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ebook-files' AND public.can_edit(auth.uid()));

CREATE POLICY "Editors can read lesson materials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lesson-materials' AND public.can_edit(auth.uid()));

-- 4) Helper to validate recipe (lesson) access for downloading materials.
--    User has access if: admin, has lifetime, has 'receitas' exclusive, OR
--    has access to any package containing the recipe.
CREATE OR REPLACE FUNCTION public.has_recipe_access(_user_id uuid, _recipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_lifetime_access WHERE user_id = _user_id)
    OR public.has_exclusive_access(_user_id, 'receitas')
    OR EXISTS (
      SELECT 1
      FROM public.recipe_packages rp
      JOIN public.user_packages up ON up.package_id = rp.package_id
      WHERE rp.recipe_id = _recipe_id
        AND up.user_id = _user_id
        AND (up.expires_at IS NULL OR up.expires_at > now())
    )
    OR EXISTS (
      SELECT 1
      FROM public.recipe_packages rp
      JOIN public.packages p ON p.id = rp.package_id
      WHERE rp.recipe_id = _recipe_id
        AND p.is_free = true
    );
$$;

-- 5) Helper to validate ebook access (purchased + not expired, OR lifetime/admin)
CREATE OR REPLACE FUNCTION public.has_ebook_access(_user_id uuid, _ebook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_lifetime_access WHERE user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_ebooks
      WHERE user_id = _user_id
        AND ebook_id = _ebook_id
        AND (expires_at IS NULL OR expires_at > now())
    );
$$;