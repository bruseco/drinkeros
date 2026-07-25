CREATE OR REPLACE FUNCTION public.propagate_user_combo_exclusive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incl boolean;
  v_lifetime boolean;
  v_expires timestamptz;
BEGIN
  SELECT includes_exclusive_access, COALESCE(is_lifetime, false)
    INTO v_incl, v_lifetime
  FROM public.combos WHERE id = NEW.combo_id;

  IF NOT COALESCE(v_incl, false) THEN
    RETURN NEW;
  END IF;

  IF v_lifetime THEN
    v_expires := NULL;
  ELSE
    v_expires := COALESCE(NEW.expires_at, NEW.purchased_at + interval '1 year');
  END IF;

  INSERT INTO public.user_exclusive_access (user_id, feature, expires_at)
  VALUES (NEW.user_id, 'receitas', v_expires)
  ON CONFLICT (user_id, feature) DO UPDATE
    SET expires_at = CASE
      WHEN EXCLUDED.expires_at IS NULL OR public.user_exclusive_access.expires_at IS NULL THEN NULL
      ELSE GREATEST(public.user_exclusive_access.expires_at, EXCLUDED.expires_at)
    END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_user_combo_exclusive_access ON public.user_combos;
CREATE TRIGGER trg_propagate_user_combo_exclusive_access
AFTER INSERT ON public.user_combos
FOR EACH ROW EXECUTE FUNCTION public.propagate_user_combo_exclusive_access();

INSERT INTO public.user_exclusive_access (user_id, feature, expires_at)
SELECT user_id, 'receitas',
  CASE WHEN bool_or(COALESCE(c.is_lifetime,false)) THEN NULL
       ELSE MAX(COALESCE(uc.expires_at, uc.purchased_at + interval '1 year')) END
FROM public.user_combos uc
JOIN public.combos c ON c.id = uc.combo_id
WHERE c.includes_exclusive_access = true AND uc.refunded_at IS NULL
GROUP BY uc.user_id
ON CONFLICT (user_id, feature) DO UPDATE
  SET expires_at = CASE
    WHEN EXCLUDED.expires_at IS NULL OR public.user_exclusive_access.expires_at IS NULL THEN NULL
    ELSE GREATEST(public.user_exclusive_access.expires_at, EXCLUDED.expires_at)
  END;