REVOKE INSERT, UPDATE ON public.app_daily_accesses FROM authenticated;

DROP POLICY IF EXISTS "Users can insert own daily app accesses" ON public.app_daily_accesses;
DROP POLICY IF EXISTS "Users can update own daily app accesses" ON public.app_daily_accesses;