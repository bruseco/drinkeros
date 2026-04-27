CREATE OR REPLACE FUNCTION public.grant_vip_exclusive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expiry timestamptz;
BEGIN
  IF NEW.plan <> 'vip' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM user_lifetime_access WHERE user_id = NEW.user_id) THEN
    v_expiry := NULL;
  ELSE
    v_expiry := COALESCE(NEW.expires_at, NEW.activated_at + interval '1 year', now() + interval '1 year');
  END IF;

  INSERT INTO public.user_exclusive_access (user_id, feature, expires_at)
  VALUES (NEW.user_id, 'receitas', v_expiry)
  ON CONFLICT (user_id, feature) DO UPDATE
    SET expires_at = CASE
      WHEN v_expiry IS NULL THEN NULL
      WHEN user_exclusive_access.expires_at IS NULL THEN user_exclusive_access.expires_at
      WHEN user_exclusive_access.expires_at < v_expiry THEN v_expiry
      ELSE user_exclusive_access.expires_at
    END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_vip_exclusive_access ON public.user_plans;
CREATE TRIGGER trg_grant_vip_exclusive_access
AFTER INSERT OR UPDATE ON public.user_plans
FOR EACH ROW
EXECUTE FUNCTION public.grant_vip_exclusive_access();

-- Backfill: sócios atuais ganham acesso aos Xaropes
INSERT INTO public.user_exclusive_access (user_id, feature, expires_at)
SELECT
  up.user_id,
  'receitas',
  CASE
    WHEN EXISTS (SELECT 1 FROM user_lifetime_access ul WHERE ul.user_id = up.user_id) THEN NULL
    ELSE COALESCE(up.expires_at, up.activated_at + interval '1 year', now() + interval '1 year')
  END
FROM public.user_plans up
WHERE up.plan = 'vip'
  AND (up.expires_at IS NULL OR up.expires_at > now())
ON CONFLICT (user_id, feature) DO NOTHING;