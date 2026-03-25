-- Add DELETE policy for recipe_views so users can unmark lessons as complete
CREATE POLICY "Users can delete own recipe views"
ON public.recipe_views
FOR DELETE
USING (auth.uid() = user_id);