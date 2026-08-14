ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fiscal_reminder_24h_at timestamptz,
  ADD COLUMN IF NOT EXISTS fiscal_reminder_48h_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_fiscal_incomplete
  ON public.profiles (updated_at)
  WHERE cpf IS NOT NULL AND (address_neighborhood IS NULL OR address_neighborhood = '');