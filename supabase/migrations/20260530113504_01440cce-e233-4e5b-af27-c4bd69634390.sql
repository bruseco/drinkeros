ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clube_exit_eligible_until timestamptz;

DROP POLICY IF EXISTS "Users can update own clube intro flags" ON public.profiles;

CREATE POLICY "Users can update own clube offer flags"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);