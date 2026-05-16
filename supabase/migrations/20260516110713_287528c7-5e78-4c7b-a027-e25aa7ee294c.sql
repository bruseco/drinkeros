CREATE TABLE public.ab_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_key TEXT NOT NULL UNIQUE,
  page_label TEXT NOT NULL,
  original_path TEXT NOT NULL,
  variant_path TEXT NOT NULL,
  traffic_split_pct INTEGER NOT NULL DEFAULT 50 CHECK (traffic_split_pct BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','finished')),
  winner TEXT CHECK (winner IN ('a','b')),
  visits_a BIGINT NOT NULL DEFAULT 0,
  visits_b BIGINT NOT NULL DEFAULT 0,
  conversions_a BIGINT NOT NULL DEFAULT 0,
  conversions_b BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_ab_tests_page_key ON public.ab_tests(page_key);
CREATE INDEX idx_ab_tests_status ON public.ab_tests(status);

ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ab_tests public read"
ON public.ab_tests FOR SELECT
USING (true);

CREATE POLICY "ab_tests admin write"
ON public.ab_tests FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_ab_tests_updated_at
BEFORE UPDATE ON public.ab_tests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ab_increment_visit(_page_key TEXT, _variant TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _variant = 'a' THEN
    UPDATE public.ab_tests SET visits_a = visits_a + 1 WHERE page_key = _page_key AND status = 'active';
  ELSIF _variant = 'b' THEN
    UPDATE public.ab_tests SET visits_b = visits_b + 1 WHERE page_key = _page_key AND status = 'active';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ab_increment_conversion(_page_key TEXT, _variant TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _variant = 'a' THEN
    UPDATE public.ab_tests SET conversions_a = conversions_a + 1 WHERE page_key = _page_key;
  ELSIF _variant = 'b' THEN
    UPDATE public.ab_tests SET conversions_b = conversions_b + 1 WHERE page_key = _page_key;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ab_increment_visit(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ab_increment_conversion(TEXT, TEXT) TO anon, authenticated;