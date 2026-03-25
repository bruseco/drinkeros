-- Add completed column to recipe_views to separate view tracking from completion
ALTER TABLE public.recipe_views
ADD COLUMN completed boolean NOT NULL DEFAULT false;

-- Mark all existing views as completed to preserve current progress
UPDATE public.recipe_views SET completed = true;