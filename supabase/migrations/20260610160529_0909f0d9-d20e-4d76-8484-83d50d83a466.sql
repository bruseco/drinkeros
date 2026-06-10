-- 1. Restrict ebooks.file_url column from public roles (signed URL flow only)
REVOKE SELECT (file_url) ON public.ebooks FROM anon, authenticated;

-- 2. Add INSERT policy for app_daily_accesses
CREATE POLICY "Users can insert own daily app accesses"
ON public.app_daily_accesses
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily app accesses"
ON public.app_daily_accesses
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Add INSERT policy for upsell_unsubscribes (users opt out themselves)
CREATE POLICY "Users can insert own unsubscribe"
ON public.upsell_unsubscribes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);