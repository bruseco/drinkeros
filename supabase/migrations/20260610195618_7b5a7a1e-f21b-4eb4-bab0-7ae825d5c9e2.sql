CREATE OR REPLACE FUNCTION public.extend_accesses_on_vip_activation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_expiry timestamptz;
BEGIN
  IF NEW.plan <> 'vip' THEN
    RETURN NEW;
  END IF;

  -- Vitalício: nunca mexe, mantém NULL
  IF EXISTS (SELECT 1 FROM user_lifetime_access WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  v_new_expiry := COALESCE(NEW.expires_at, NEW.activated_at + interval '1 year', now() + interval '1 year');

  -- Estende TODOS os acessos do usuário enquanto for Sócio (inclusive importados do WooCommerce).
  -- Mantém expires_at NULL (vitalício pontual) e não reduz uma data já maior.
  UPDATE user_courses  SET expires_at = v_new_expiry
   WHERE user_id = NEW.user_id AND expires_at IS NOT NULL AND expires_at < v_new_expiry;
  UPDATE user_combos   SET expires_at = v_new_expiry
   WHERE user_id = NEW.user_id AND expires_at IS NOT NULL AND expires_at < v_new_expiry;
  UPDATE user_ebooks   SET expires_at = v_new_expiry
   WHERE user_id = NEW.user_id AND expires_at IS NOT NULL AND expires_at < v_new_expiry;
  UPDATE user_packages SET expires_at = v_new_expiry
   WHERE user_id = NEW.user_id AND expires_at IS NOT NULL AND expires_at < v_new_expiry;

  RETURN NEW;
END;
$function$;

-- Backfill: para todo Sócio (VIP) atualmente ativo, estende acessos já existentes
-- (cursos/ebooks/combos/pacotes) até o fim do plano, inclusive os importados.
DO $backfill$
DECLARE r record;
DECLARE v_new_expiry timestamptz;
BEGIN
  FOR r IN
    SELECT up.user_id, up.activated_at, up.expires_at
    FROM public.user_plans up
    WHERE up.plan = 'vip'
      AND (up.expires_at IS NULL OR up.expires_at > now())
      AND NOT EXISTS (SELECT 1 FROM public.user_lifetime_access la WHERE la.user_id = up.user_id)
  LOOP
    v_new_expiry := COALESCE(r.expires_at, r.activated_at + interval '1 year', now() + interval '1 year');
    UPDATE public.user_courses  SET expires_at = v_new_expiry
     WHERE user_id = r.user_id AND expires_at IS NOT NULL AND expires_at < v_new_expiry;
    UPDATE public.user_combos   SET expires_at = v_new_expiry
     WHERE user_id = r.user_id AND expires_at IS NOT NULL AND expires_at < v_new_expiry;
    UPDATE public.user_ebooks   SET expires_at = v_new_expiry
     WHERE user_id = r.user_id AND expires_at IS NOT NULL AND expires_at < v_new_expiry;
    UPDATE public.user_packages SET expires_at = v_new_expiry
     WHERE user_id = r.user_id AND expires_at IS NOT NULL AND expires_at < v_new_expiry;
  END LOOP;
END;
$backfill$;