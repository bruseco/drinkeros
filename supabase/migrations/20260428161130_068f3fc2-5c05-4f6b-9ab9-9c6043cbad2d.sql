ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pwa_installed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_pwa_open_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_pwa_installed_at ON public.profiles(pwa_installed_at);