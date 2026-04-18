-- Function: extend all user accesses by 1 year from VIP activation
CREATE OR REPLACE FUNCTION public.extend_accesses_on_vip_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_expiry timestamptz;
BEGIN
  -- Only act when plan becomes 'vip' (insert) OR is updated to vip / has expires_at refreshed
  IF NEW.plan <> 'vip' THEN
    RETURN NEW;
  END IF;

  -- Skip if user has lifetime access
  IF EXISTS (SELECT 1 FROM user_lifetime_access WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  -- New expiration: VIP expires_at if defined, else activated_at + 1 year, else now + 1 year
  v_new_expiry := COALESCE(NEW.expires_at, NEW.activated_at + interval '1 year', now() + interval '1 year');

  -- Extend courses (only if current expiry is sooner than new one, or already expired)
  UPDATE user_courses
  SET expires_at = v_new_expiry
  WHERE user_id = NEW.user_id
    AND (expires_at IS NULL OR expires_at < v_new_expiry);

  UPDATE user_combos
  SET expires_at = v_new_expiry
  WHERE user_id = NEW.user_id
    AND (expires_at IS NULL OR expires_at < v_new_expiry);

  UPDATE user_ebooks
  SET expires_at = v_new_expiry
  WHERE user_id = NEW.user_id
    AND (expires_at IS NULL OR expires_at < v_new_expiry);

  UPDATE user_packages
  SET expires_at = v_new_expiry
  WHERE user_id = NEW.user_id
    AND (expires_at IS NULL OR expires_at < v_new_expiry);

  RETURN NEW;
END;
$$;

-- Trigger: fires after insert or update on user_plans when plan becomes vip
DROP TRIGGER IF EXISTS trg_extend_accesses_on_vip ON public.user_plans;

CREATE TRIGGER trg_extend_accesses_on_vip
AFTER INSERT OR UPDATE OF plan, expires_at, activated_at
ON public.user_plans
FOR EACH ROW
WHEN (NEW.plan = 'vip')
EXECUTE FUNCTION public.extend_accesses_on_vip_activation();