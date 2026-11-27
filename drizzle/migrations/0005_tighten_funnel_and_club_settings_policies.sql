DROP POLICY IF EXISTS "funnel insert public" ON public.page_funnel_events;
REVOKE INSERT ON public.page_funnel_events FROM anon, authenticated;
DROP POLICY IF EXISTS "clube_settings public read" ON public.clube_settings;
CREATE POLICY "clube_settings public read" ON public.clube_settings FOR SELECT TO anon, authenticated USING (singleton IS TRUE);