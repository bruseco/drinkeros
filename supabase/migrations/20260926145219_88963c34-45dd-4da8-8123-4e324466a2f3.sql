CREATE TABLE public.post_purchase_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_key text NOT NULL,
  source_payment_id text NOT NULL,
  source_user_id uuid,
  buyer_email text NOT NULL,
  buyer_name text,
  buyer_cpf text,
  status text NOT NULL DEFAULT 'offered',
  upsell_payment_id text,
  upsell_payment_method text,
  amount numeric,
  checkout_attempts int NOT NULL DEFAULT 0,
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  checkout_started_at timestamptz,
  paid_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '6 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_key, source_payment_id)
);
GRANT ALL ON public.post_purchase_offers TO service_role;
GRANT SELECT ON public.post_purchase_offers TO authenticated;
ALTER TABLE public.post_purchase_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read post purchase offers" ON public.post_purchase_offers
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX post_purchase_offers_upsell_payment_idx ON public.post_purchase_offers(upsell_payment_id);