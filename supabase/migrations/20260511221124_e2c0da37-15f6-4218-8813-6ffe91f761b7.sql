CREATE OR REPLACE FUNCTION public.get_user_plan_v2(_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_lifetime_access WHERE user_id = _user_id) THEN 'vitalicio'
    WHEN public.is_admin(_user_id) THEN 'socio'
    WHEN EXISTS (
      SELECT 1 FROM public.user_plans
      WHERE user_id = _user_id
        AND plan = 'vip'
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN 'socio'
    WHEN EXISTS (
      SELECT 1 FROM public.user_courses
      WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now())
    )
      OR EXISTS (
        SELECT 1 FROM public.user_ebooks
        WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now())
      )
      OR EXISTS (
        SELECT 1 FROM public.user_combos
        WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now())
      )
      OR EXISTS (
        SELECT 1 FROM public.user_packages
        WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now())
      )
    THEN 'aluno'
    ELSE 'free'
  END;
$function$;