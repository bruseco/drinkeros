DROP POLICY IF EXISTS "Authenticated upload avatars" ON storage.objects;
CREATE POLICY "Authenticated upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Owner update avatars" ON storage.objects;
CREATE POLICY "Owner update avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated upload club-recipes" ON storage.objects;
CREATE POLICY "Authenticated upload club-recipes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'club-recipes'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Owner update club-recipes" ON storage.objects;
CREATE POLICY "Owner update club-recipes"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'club-recipes' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'club-recipes' AND (storage.foldername(name))[1] = auth.uid()::text);