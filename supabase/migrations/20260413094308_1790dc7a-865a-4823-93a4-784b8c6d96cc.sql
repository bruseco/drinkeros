
-- Add expires_at to access tables (null = lifetime)
ALTER TABLE public.user_courses ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.user_combos ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.user_ebooks ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.user_packages ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT NULL;

-- Lifetime access table
CREATE TABLE public.user_lifetime_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  granted_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_lifetime_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user_lifetime_access"
  ON public.user_lifetime_access FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own lifetime access"
  ON public.user_lifetime_access FOR SELECT
  USING (auth.uid() = user_id);

-- Function: set expires_at on insert (1 year unless lifetime)
CREATE OR REPLACE FUNCTION public.set_access_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If expires_at was explicitly set, keep it
  IF NEW.expires_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check if user has lifetime access
  IF EXISTS (SELECT 1 FROM user_lifetime_access WHERE user_id = NEW.user_id) THEN
    NEW.expires_at := NULL; -- lifetime
  ELSE
    NEW.expires_at := COALESCE(NEW.purchased_at, now()) + interval '1 year';
  END IF;

  RETURN NEW;
END;
$$;

-- Apply trigger to all access tables
CREATE TRIGGER set_user_courses_expiration
  BEFORE INSERT ON public.user_courses
  FOR EACH ROW EXECUTE FUNCTION public.set_access_expiration();

CREATE TRIGGER set_user_combos_expiration
  BEFORE INSERT ON public.user_combos
  FOR EACH ROW EXECUTE FUNCTION public.set_access_expiration();

CREATE TRIGGER set_user_ebooks_expiration
  BEFORE INSERT ON public.user_ebooks
  FOR EACH ROW EXECUTE FUNCTION public.set_access_expiration();

CREATE TRIGGER set_user_packages_expiration
  BEFORE INSERT ON public.user_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_access_expiration();

-- Function: when lifetime granted, remove all expirations
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_lifetime_access_granted
  AFTER INSERT ON public.user_lifetime_access
  FOR EACH ROW EXECUTE FUNCTION public.propagate_lifetime_access();
