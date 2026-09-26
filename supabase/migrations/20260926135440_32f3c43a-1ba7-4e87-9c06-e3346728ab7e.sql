-- 1) Backfill: acessos não estornados tornam-se permanentes
UPDATE public.user_ebooks SET expires_at = NULL WHERE refunded_at IS NULL AND expires_at IS NOT NULL;

-- 2) Garantia no banco: e-book não estornado nunca tem expires_at
CREATE OR REPLACE FUNCTION public.enforce_ebook_permanent_access()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.refunded_at IS NULL THEN
    NEW.expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_ebooks_expiration ON public.user_ebooks;
DROP TRIGGER IF EXISTS enforce_user_ebooks_permanent ON public.user_ebooks;
CREATE TRIGGER enforce_user_ebooks_permanent
BEFORE INSERT OR UPDATE ON public.user_ebooks
FOR EACH ROW EXECUTE FUNCTION public.enforce_ebook_permanent_access();

-- 3) Autorização: sem dependência de expires_at
CREATE OR REPLACE FUNCTION public.has_ebook_access(_user_id uuid, _ebook_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    public.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_lifetime_access WHERE user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_ebooks
      WHERE user_id = _user_id AND ebook_id = _ebook_id AND refunded_at IS NULL
    );
$$;

-- 4) Propagação por combo: e-book sempre permanente, preservando origem/data
CREATE OR REPLACE FUNCTION public.propagate_user_combo_ebook_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.user_ebooks (user_id, ebook_id, purchased_at, expires_at, source)
  SELECT NEW.user_id, ce.ebook_id, NEW.purchased_at, NULL, NEW.source
  FROM public.combo_ebooks ce
  WHERE ce.combo_id = NEW.combo_id
  ON CONFLICT (user_id, ebook_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 5) Clube não altera validade de e-book
CREATE OR REPLACE FUNCTION public.extend_accesses_on_vip_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_new_expiry timestamptz;
BEGIN
  IF NEW.plan <> 'vip' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM user_lifetime_access WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;

  v_new_expiry := COALESCE(NEW.expires_at, NEW.activated_at + interval '1 year', now() + interval '1 year');

  -- E-books são permanentes e não entram aqui.
  UPDATE user_courses  SET expires_at = v_new_expiry
   WHERE user_id = NEW.user_id AND expires_at IS NOT NULL AND expires_at < v_new_expiry;
  UPDATE user_combos   SET expires_at = v_new_expiry
   WHERE user_id = NEW.user_id AND expires_at IS NOT NULL AND expires_at < v_new_expiry;
  UPDATE user_packages SET expires_at = v_new_expiry
   WHERE user_id = NEW.user_id AND expires_at IS NOT NULL AND expires_at < v_new_expiry;
  RETURN NEW;
END;
$$;

-- 6) Plano "Aluno": e-book conta enquanto não estornado
CREATE OR REPLACE FUNCTION public.get_user_plan_v2(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_lifetime_access WHERE user_id = _user_id) THEN 'vitalicio'
    WHEN public.is_admin(_user_id) THEN 'socio'
    WHEN EXISTS (
      SELECT 1 FROM public.user_plans
      WHERE user_id = _user_id AND plan = 'vip' AND (expires_at IS NULL OR expires_at > now())
    ) THEN 'socio'
    WHEN EXISTS (
      SELECT 1 FROM public.user_exclusive_access
      WHERE user_id = _user_id AND feature = 'receitas' AND (expires_at IS NULL OR expires_at > now())
    ) THEN 'socio'
    WHEN EXISTS (SELECT 1 FROM public.user_courses WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now()))
      OR EXISTS (SELECT 1 FROM public.user_ebooks WHERE user_id = _user_id AND refunded_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.user_combos WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now()))
      OR EXISTS (SELECT 1 FROM public.user_packages WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now()))
    THEN 'aluno'
    ELSE 'free'
  END;
$$;