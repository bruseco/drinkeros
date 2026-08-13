DROP POLICY IF EXISTS "Authenticated users can upload whatsapp media" ON storage.objects;

CREATE POLICY "Admins can upload whatsapp media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media' AND public.is_admin(auth.uid()));