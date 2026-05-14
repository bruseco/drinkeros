
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS discount_intro_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.start_vip_discount_window()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_started timestamptz;
  v_is_lifetime boolean;
  v_is_socio boolean;
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

  IF NOT (v_is_lifetime OR v_is_socio) THEN
    RETURN NULL;
  END IF;

  -- Garante linha em user_plans
  INSERT INTO public.user_plans (user_id, plan, discount_intro_started_at)
  VALUES (v_user, CASE WHEN v_is_socio THEN 'vip' ELSE 'free' END, now())
  ON CONFLICT (user_id) DO UPDATE
    SET discount_intro_started_at = COALESCE(public.user_plans.discount_intro_started_at, now())
  RETURNING discount_intro_started_at INTO v_started;

  RETURN v_started;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_vip_discount_window() TO authenticated;
