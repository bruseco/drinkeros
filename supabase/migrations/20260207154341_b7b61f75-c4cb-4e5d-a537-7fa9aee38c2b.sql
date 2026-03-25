-- Add is_free column to packages
ALTER TABLE public.packages ADD COLUMN is_free boolean NOT NULL DEFAULT false;

-- Update RLS policy on recipes to also allow access to free package recipes
DROP POLICY IF EXISTS "Users can view published recipes from their packages" ON public.recipes;

CREATE POLICY "Users can view published recipes from their packages"
ON public.recipes
FOR SELECT
USING (
  (status = 'published' AND (
    EXISTS (
      SELECT 1 FROM recipe_packages rp
      JOIN user_packages up ON up.package_id = rp.package_id
      WHERE rp.recipe_id = recipes.id AND up.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM recipe_packages rp
      JOIN packages p ON p.id = rp.package_id
      WHERE rp.recipe_id = recipes.id AND p.is_free = true
    )
  ))
);

-- Also update has_package_access function to include free packages
CREATE OR REPLACE FUNCTION public.has_package_access(_user_id uuid, _package_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_packages
    WHERE user_id = _user_id
      AND package_id = _package_id
  ) 
  OR EXISTS (
    SELECT 1
    FROM public.packages
    WHERE id = _package_id
      AND is_free = true
  )
  OR public.is_admin(_user_id)
$$;