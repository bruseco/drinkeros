CREATE OR REPLACE FUNCTION public.count_weekly_views(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.daily_recipe_views
  WHERE user_id = _user_id
    AND view_date > ((now() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '7 days');
$$;

GRANT EXECUTE ON FUNCTION public.count_weekly_views(uuid) TO authenticated, service_role;