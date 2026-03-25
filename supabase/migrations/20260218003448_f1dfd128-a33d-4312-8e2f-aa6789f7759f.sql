
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS transcript_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes_status text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_recipes_transcript_status ON public.recipes(transcript_status);
CREATE INDEX IF NOT EXISTS idx_recipes_notes_status ON public.recipes(notes_status);
