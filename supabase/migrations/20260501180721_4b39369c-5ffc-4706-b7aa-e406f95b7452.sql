
CREATE TABLE IF NOT EXISTS public.vip_renewal_reminders_sent (
  user_id uuid NOT NULL,
  template text NOT NULL,
  expires_at_snapshot timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, template, expires_at_snapshot)
);

ALTER TABLE public.vip_renewal_reminders_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view renewal reminders log" ON public.vip_renewal_reminders_sent;
CREATE POLICY "Admins can view renewal reminders log"
  ON public.vip_renewal_reminders_sent
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_vip_renewal_reminders_user_v2
  ON public.vip_renewal_reminders_sent(user_id);
