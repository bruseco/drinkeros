ALTER TABLE public.post_purchase_offers
  ADD COLUMN IF NOT EXISTS watched_seconds numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS events jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Marca um evento uma única vez por oferta (atômico, sem corrida entre abas).
CREATE OR REPLACE FUNCTION public.ppo_mark_event(_offer_id uuid, _event text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH u AS (
    UPDATE public.post_purchase_offers
       SET events = events || jsonb_build_object(_event, now()), updated_at = now()
     WHERE id = _offer_id AND NOT (events ? _event)
     RETURNING 1
  ) SELECT EXISTS (SELECT 1 FROM u);
$$;
REVOKE ALL ON FUNCTION public.ppo_mark_event(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ppo_mark_event(uuid, text) TO service_role;