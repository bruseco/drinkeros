
-- Create table for multiple materials per lesson
CREATE TABLE public.recipe_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipe_materials ENABLE ROW LEVEL SECURITY;

-- Editors can manage materials
CREATE POLICY "Editors can manage recipe_materials"
ON public.recipe_materials
FOR ALL
USING (can_edit(auth.uid()));

-- Users can view materials of recipes they have access to
CREATE POLICY "Users can view recipe_materials"
ON public.recipe_materials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM recipes r WHERE r.id = recipe_materials.recipe_id
  )
);

-- Migrate existing material_url data
INSERT INTO public.recipe_materials (recipe_id, name, file_url, display_order)
SELECT id, 'Material', material_url, 0
FROM public.recipes
WHERE material_url IS NOT NULL AND material_url != '';
