
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id text,
  product_name text NOT NULL,
  product_type text NOT NULL,
  gateway text NOT NULL CHECK (gateway IN ('stripe','mercado_pago')),
  amount_paid numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL,
  transaction_id text NOT NULL,
  meta_purchase_sent boolean NOT NULL DEFAULT false,
  meta_purchase_sent_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_unsent ON public.purchases(user_id, meta_purchase_sent, created_at DESC);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own purchases"
  ON public.purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all purchases"
  ON public.purchases FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
