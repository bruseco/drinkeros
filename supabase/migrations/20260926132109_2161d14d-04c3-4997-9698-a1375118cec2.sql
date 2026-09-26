ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pwa_prompt_last_shown_at timestamptz,
  ADD COLUMN IF NOT EXISTS pwa_prompt_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS push_prompt_last_shown_at timestamptz,
  ADD COLUMN IF NOT EXISTS push_opted_out_at timestamptz;

CREATE OR REPLACE FUNCTION public.record_engagement_prompt(_prompt text, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _prompt NOT IN ('pwa','push') OR _action NOT IN ('shown','accepted','dismissed','denied') THEN
    RAISE EXCEPTION 'invalid args';
  END IF;

  IF _prompt = 'pwa' AND _action = 'shown' THEN
    UPDATE profiles SET pwa_prompt_last_shown_at = now() WHERE user_id = uid;
  ELSIF _prompt = 'pwa' AND _action = 'dismissed' THEN
    UPDATE profiles SET pwa_prompt_dismissed_at = now() WHERE user_id = uid;
  ELSIF _prompt = 'push' AND _action = 'shown' THEN
    UPDATE profiles SET push_prompt_last_shown_at = now() WHERE user_id = uid;
  ELSIF _prompt = 'push' AND _action IN ('dismissed','denied') THEN
    UPDATE profiles SET push_opted_out_at = now() WHERE user_id = uid;
  END IF;

  INSERT INTO ux_interactions (user_id, event_type, metadata)
  VALUES (uid, 'engagement_prompt', jsonb_build_object('prompt', _prompt, 'action', _action));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_engagement_prompt(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_engagement_prompt(text, text) TO authenticated;