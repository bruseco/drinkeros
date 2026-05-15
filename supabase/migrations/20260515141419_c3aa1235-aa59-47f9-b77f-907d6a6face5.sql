CREATE OR REPLACE FUNCTION public.get_total_club_members()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM (
    SELECT user_id FROM public.user_plans
      WHERE plan = 'vip' AND (expires_at IS NULL OR expires_at > now())
    UNION
    SELECT user_id FROM public.user_lifetime_access
  ) m;
$$;

GRANT EXECUTE ON FUNCTION public.get_total_club_members() TO anon, authenticated;