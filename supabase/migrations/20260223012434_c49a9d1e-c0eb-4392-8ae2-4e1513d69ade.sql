
-- Function to get recipe metadata for a package (bypasses RLS, returns only safe fields)
CREATE OR REPLACE FUNCTION public.get_package_recipe_metadata(p_package_id uuid)
RETURNS TABLE(id uuid, name text, image_url text, display_order int) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT r.id, r.name, r.image_url, COALESCE(rp.display_order, 0) as display_order
  FROM recipe_packages rp
  JOIN recipes r ON r.id = rp.recipe_id
  WHERE rp.package_id = p_package_id
  AND r.status = 'published'
  ORDER BY rp.display_order ASC NULLS LAST;
$$;
