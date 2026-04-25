ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

ALTER TABLE public.ebooks
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

CREATE INDEX IF NOT EXISTS idx_courses_stripe_price ON public.courses(stripe_price_id) WHERE stripe_price_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ebooks_stripe_price ON public.ebooks(stripe_price_id) WHERE stripe_price_id IS NOT NULL;