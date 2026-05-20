ALTER TABLE public.exclusive_posts
  ADD COLUMN IF NOT EXISTS yield_ml integer,
  ADD COLUMN IF NOT EXISTS drinks_count integer,
  ADD COLUMN IF NOT EXISTS serves_people integer,
  ADD COLUMN IF NOT EXISTS yield_analyzed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_exclusive_posts_yield_analyzed_at
  ON public.exclusive_posts(yield_analyzed_at);