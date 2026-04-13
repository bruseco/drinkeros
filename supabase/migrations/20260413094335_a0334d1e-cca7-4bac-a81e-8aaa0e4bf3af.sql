
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
      AND (expires_at IS NULL OR expires_at > now())
  ) 
  OR EXISTS (
    SELECT 1
    FROM public.packages
    WHERE id = _package_id
      AND is_free = true
  )
  OR public.is_admin(_user_id)
$$;
