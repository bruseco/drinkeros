CREATE OR REPLACE FUNCTION public.ensure_clube_intro_offer()
RETURNS TABLE (
  clube_intro_eligible_until timestamptz,
  clube_intro_revealed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text := COALESCE(auth.jwt() ->> 'email', '');
  v_full_name text := COALESCE(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', NULL);
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, email, full_name, clube_intro_eligible_until)
    VALUES (v_user, v_email, v_full_name, now() + interval '30 minutes')
    RETURNING * INTO v_profile;
  ELSIF v_profile.clube_intro_revealed_at IS NULL
    AND (
      v_profile.clube_intro_eligible_until IS NULL
      OR (
        v_profile.clube_intro_eligible_until < now()
        AND v_profile.created_at >= now() - interval '24 hours'
      )
    ) THEN
    UPDATE public.profiles
    SET clube_intro_eligible_until = now() + interval '30 minutes'
    WHERE user_id = v_user
    RETURNING * INTO v_profile;
  END IF;

  clube_intro_eligible_until := v_profile.clube_intro_eligible_until;
  clube_intro_revealed_at := v_profile.clube_intro_revealed_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_clube_intro_offer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_clube_intro_offer() TO service_role;

UPDATE public.profiles
SET clube_intro_eligible_until = now() + interval '30 minutes'
WHERE clube_intro_revealed_at IS NULL
  AND created_at >= now() - interval '24 hours'
  AND (clube_intro_eligible_until IS NULL OR clube_intro_eligible_until < now());