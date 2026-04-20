-- Add expires_at to user_exclusive_access (for Clube Anual = 1 year exclusive access)
ALTER TABLE public.user_exclusive_access ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Update has_exclusive_access to respect expiration
CREATE OR REPLACE FUNCTION public.has_exclusive_access(_user_id uuid, _feature text DEFAULT 'receitas'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_exclusive_access
    WHERE user_id = _user_id
      AND feature = _feature
      AND (expires_at IS NULL OR expires_at > now())
  )
  OR public.is_admin(_user_id)
$function$;

-- Add 'source' column to access tables to mark imported records
ALTER TABLE public.user_courses  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.user_combos   ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.user_ebooks   ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.user_packages ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- Adjust VIP-extension trigger to NOT touch imported rows (preserve historic dates)
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

  IF EXISTS (SELECT 1 FROM user_lifetime_access WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  v_new_expiry := COALESCE(NEW.expires_at, NEW.activated_at + interval '1 year', now() + interval '1 year');

  UPDATE user_courses  SET expires_at = v_new_expiry
   WHERE user_id = NEW.user_id AND source <> 'import' AND (expires_at IS NULL OR expires_at < v_new_expiry);
  UPDATE user_combos   SET expires_at = v_new_expiry
   WHERE user_id = NEW.user_id AND source <> 'import' AND (expires_at IS NULL OR expires_at < v_new_expiry);
  UPDATE user_ebooks   SET expires_at = v_new_expiry
   WHERE user_id = NEW.user_id AND source <> 'import' AND (expires_at IS NULL OR expires_at < v_new_expiry);
  UPDATE user_packages SET expires_at = v_new_expiry
   WHERE user_id = NEW.user_id AND source <> 'import' AND (expires_at IS NULL OR expires_at < v_new_expiry);

  RETURN NEW;
END;
$function$;