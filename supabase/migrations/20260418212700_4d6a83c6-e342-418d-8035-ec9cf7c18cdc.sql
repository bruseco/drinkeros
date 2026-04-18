ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS price numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_price numeric(10,2);