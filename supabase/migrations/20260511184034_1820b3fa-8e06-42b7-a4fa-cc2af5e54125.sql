
-- 1) BEFORE INSERT trigger on user_exclusive_access to enforce expiration logic
CREATE OR REPLACE FUNCTION public.set_exclusive_access_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_lifetime_access WHERE user_id = NEW.user_id) THEN
    NEW.expires_at := NULL;
  ELSIF NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '1 year';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_exclusive_access_expiration ON public.user_exclusive_access;
CREATE TRIGGER trg_set_exclusive_access_expiration
BEFORE INSERT ON public.user_exclusive_access
FOR EACH ROW EXECUTE FUNCTION public.set_exclusive_access_expiration();

-- 2) Update propagate_lifetime_access to also handle user_exclusive_access
CREATE OR REPLACE FUNCTION public.propagate_lifetime_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE user_courses SET expires_at = NULL WHERE user_id = NEW.user_id AND expires_at IS NOT NULL;
  UPDATE user_combos SET expires_at = NULL WHERE user_id = NEW.user_id AND expires_at IS NOT NULL;
  UPDATE user_ebooks SET expires_at = NULL WHERE user_id = NEW.user_id AND expires_at IS NOT NULL;
  UPDATE user_packages SET expires_at = NULL WHERE user_id = NEW.user_id AND expires_at IS NOT NULL;
  UPDATE user_exclusive_access SET expires_at = NULL WHERE user_id = NEW.user_id AND expires_at IS NOT NULL;
  INSERT INTO user_exclusive_access (user_id, feature, expires_at)
  VALUES (NEW.user_id, 'receitas', NULL)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3) Backfill: lifetime users -> NULL expires
UPDATE public.user_exclusive_access uea
SET expires_at = NULL
WHERE expires_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.user_lifetime_access ula WHERE ula.user_id = uea.user_id);

-- 4) Backfill: lifetime users missing receitas access -> grant
INSERT INTO public.user_exclusive_access (user_id, feature, expires_at)
SELECT ula.user_id, 'receitas', NULL
FROM public.user_lifetime_access ula
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_exclusive_access uea
  WHERE uea.user_id = ula.user_id AND uea.feature = 'receitas'
)
ON CONFLICT DO NOTHING;

-- 5) Backfill: non-lifetime users with NULL expires -> 1 year from created_at
UPDATE public.user_exclusive_access uea
SET expires_at = uea.created_at + interval '1 year'
WHERE uea.expires_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_lifetime_access ula WHERE ula.user_id = uea.user_id);
