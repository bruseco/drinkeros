CREATE TABLE public.push_campaign_runs (
  run_key text PRIMARY KEY,
  campaign text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  total_subscriptions integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  removed_count integer NOT NULL DEFAULT 0,
  last_error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.push_campaign_runs TO authenticated;
GRANT ALL ON public.push_campaign_runs TO service_role;
ALTER TABLE public.push_campaign_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view push campaign runs" ON public.push_campaign_runs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));