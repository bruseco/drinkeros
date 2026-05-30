
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clube_intro_eligible_until timestamptz,
  ADD COLUMN IF NOT EXISTS clube_intro_revealed_at timestamptz;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name, clube_intro_eligible_until)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', now() + interval '30 minutes');

    INSERT INTO public.user_plans (user_id, plan)
    VALUES (NEW.id, 'free')
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Permite o próprio usuário marcar quando viu a animação (sem precisar de service role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update own clube intro flags'
  ) THEN
    CREATE POLICY "Users can update own clube intro flags"
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
