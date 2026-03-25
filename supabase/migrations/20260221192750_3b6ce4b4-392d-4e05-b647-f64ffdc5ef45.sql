
-- Create whatsapp-media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

-- Allow public read access
CREATE POLICY "Public can view whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete whatsapp media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');
