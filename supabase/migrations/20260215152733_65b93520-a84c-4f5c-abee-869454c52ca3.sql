
-- Table to track onboarding follow-up notifications sent
CREATE TABLE public.onboarding_followup_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  phone text,
  email text,
  whatsapp_sent boolean NOT NULL DEFAULT false,
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate follow-ups per user
CREATE UNIQUE INDEX idx_onboarding_followup_user ON public.onboarding_followup_logs (user_id);

-- Enable RLS
ALTER TABLE public.onboarding_followup_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can access
CREATE POLICY "Admins can manage onboarding_followup_logs"
  ON public.onboarding_followup_logs
  FOR ALL
  USING (is_admin(auth.uid()));
