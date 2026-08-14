CREATE TABLE public.landing_offer_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_key TEXT NOT NULL,
  name TEXT,
  email TEXT NOT NULL,
  user_id UUID,
  discount_token TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  ineligible_at TIMESTAMPTZ,
  ineligible_reason TEXT,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.landing_offer_leads TO service_role;
GRANT SELECT ON public.landing_offer_leads TO authenticated;

ALTER TABLE public.landing_offer_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view offer leads"
ON public.landing_offer_leads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'editor'));

CREATE INDEX idx_landing_offer_leads_email ON public.landing_offer_leads (lower(email));
CREATE INDEX idx_landing_offer_leads_pending ON public.landing_offer_leads (page_key, created_at) WHERE email_sent_at IS NULL AND ineligible_at IS NULL;

CREATE TRIGGER update_landing_offer_leads_updated_at
BEFORE UPDATE ON public.landing_offer_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();