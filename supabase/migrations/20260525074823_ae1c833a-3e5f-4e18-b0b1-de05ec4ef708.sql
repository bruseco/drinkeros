
-- 1) Storage policies for ebook-files bucket: enforce editor role on write ops
DROP POLICY IF EXISTS "Editors can delete ebook files" ON storage.objects;
DROP POLICY IF EXISTS "Editors can update ebook files" ON storage.objects;
DROP POLICY IF EXISTS "Editors can upload ebook files" ON storage.objects;

CREATE POLICY "Editors can delete ebook files"
ON storage.objects FOR DELETE
USING (bucket_id = 'ebook-files' AND public.can_edit(auth.uid()));

CREATE POLICY "Editors can update ebook files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'ebook-files' AND public.can_edit(auth.uid()))
WITH CHECK (bucket_id = 'ebook-files' AND public.can_edit(auth.uid()));

CREATE POLICY "Editors can upload ebook files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ebook-files' AND public.can_edit(auth.uid()));

-- 2) ebooks.file_url should not be readable by anonymous users
REVOKE SELECT (file_url) ON public.ebooks FROM anon;

-- 3) exclusive_posts: require authentication to read published posts
DROP POLICY IF EXISTS "Anyone can view published exclusive posts" ON public.exclusive_posts;
CREATE POLICY "Authenticated users can view published exclusive posts"
ON public.exclusive_posts FOR SELECT
USING (
  (is_published = true AND auth.uid() IS NOT NULL)
  OR public.is_admin(auth.uid())
);

-- 4) recipe_materials: require authentication
DROP POLICY IF EXISTS "Users can view recipe_materials" ON public.recipe_materials;
CREATE POLICY "Authenticated users can view recipe_materials"
ON public.recipe_materials FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_materials.recipe_id)
);
