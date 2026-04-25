
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-assets', 'landing-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read landing-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-assets');
