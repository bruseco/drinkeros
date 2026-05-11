CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.is_admin(_user_id) THEN 'vip'
    WHEN EXISTS (
      SELECT 1 FROM public.user_lifetime_access WHERE user_id = _user_id
    ) THEN 'vip'
    WHEN EXISTS (
      SELECT 1 FROM public.user_plans
      WHERE user_id = _user_id
        AND plan = 'vip'
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN 'vip'
    ELSE 'free'
  END;
$function$;