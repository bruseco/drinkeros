
CREATE OR REPLACE FUNCTION public.get_user_plan_v2(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_lifetime_access WHERE user_id = _user_id) THEN 'vitalicio'
    WHEN public.is_admin(_user_id) THEN 'socio'
    WHEN EXISTS (
      SELECT 1 FROM public.user_plans
      WHERE user_id = _user_id
        AND plan = 'vip'
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN 'socio'
    -- Sócio legacy: acesso manual à categoria Receitas (vinha do Clube antigo)
    WHEN EXISTS (
      SELECT 1 FROM public.user_exclusive_access
      WHERE user_id = _user_id
        AND feature = 'receitas'
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
$$;

CREATE OR REPLACE FUNCTION public.start_vip_discount_window()
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_started timestamptz;
  v_is_lifetime boolean;
  v_is_socio boolean;
  v_is_legacy boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_lifetime_access WHERE user_id = v_user)
    INTO v_is_lifetime;

  SELECT EXISTS (
    SELECT 1 FROM public.user_plans
    WHERE user_id = v_user
      AND plan = 'vip'
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_is_socio;

  SELECT EXISTS (
    SELECT 1 FROM public.user_exclusive_access
    WHERE user_id = v_user
      AND feature = 'receitas'
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_is_legacy;

  IF NOT (v_is_lifetime OR v_is_socio OR v_is_legacy) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_plans (user_id, plan, discount_intro_started_at)
  VALUES (v_user, CASE WHEN v_is_socio THEN 'vip' ELSE 'free' END, now())
  ON CONFLICT (user_id) DO UPDATE
    SET discount_intro_started_at = COALESCE(public.user_plans.discount_intro_started_at, now())
  RETURNING discount_intro_started_at INTO v_started;

  RETURN v_started;
END;
$$;
