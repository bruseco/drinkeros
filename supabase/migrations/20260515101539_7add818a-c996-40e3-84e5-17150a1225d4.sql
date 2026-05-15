CREATE OR REPLACE FUNCTION public.get_total_students_certified()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 22341::bigint + COALESCE((SELECT COUNT(DISTINCT user_id) FROM public.user_courses), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_total_students_certified() TO anon, authenticated;