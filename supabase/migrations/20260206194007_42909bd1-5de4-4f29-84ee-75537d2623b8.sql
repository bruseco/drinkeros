
-- Add material_url column to recipes table for companion material downloads
ALTER TABLE public.recipes ADD COLUMN material_url text;

-- Create a storage bucket for lesson materials (PDFs, docs, etc.)
INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-materials', 'lesson-materials', true);

-- Allow anyone to view lesson materials (public bucket)
CREATE POLICY "Anyone can view lesson materials"
ON storage.objects FOR SELECT
USING (bucket_id = 'lesson-materials');

-- Allow editors/admins to upload lesson materials
CREATE POLICY "Editors can upload lesson materials"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lesson-materials' AND public.can_edit(auth.uid()));

-- Allow editors/admins to update lesson materials
CREATE POLICY "Editors can update lesson materials"
ON storage.objects FOR UPDATE
USING (bucket_id = 'lesson-materials' AND public.can_edit(auth.uid()));

-- Allow editors/admins to delete lesson materials
CREATE POLICY "Editors can delete lesson materials"
ON storage.objects FOR DELETE
USING (bucket_id = 'lesson-materials' AND public.can_edit(auth.uid()));
