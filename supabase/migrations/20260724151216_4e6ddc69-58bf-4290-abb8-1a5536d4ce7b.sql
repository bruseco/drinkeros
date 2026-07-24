
-- 1) Hide ebooks.file_url from clients (use signed URL edge function)
REVOKE SELECT (file_url) ON public.ebooks FROM anon, authenticated;

-- 2) Restrict profile updates on other users to super_admin only
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Super admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 3) Lock down whatsapp-media storage bucket to admins only
DROP POLICY IF EXISTS "Public can view whatsapp media" ON storage.objects;
CREATE POLICY "Admins can view whatsapp media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'whatsapp-media' AND public.is_admin(auth.uid()));
