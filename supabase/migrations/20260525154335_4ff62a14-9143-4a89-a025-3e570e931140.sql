-- 1. Novos campos em purchases (user_id continua NOT NULL)
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS buyer_email text,
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS user_was_created boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_purchases_buyer_email ON public.purchases (buyer_email);

-- 2. Nova tabela de logs de falhas
CREATE TABLE IF NOT EXISTS public.webhook_purchase_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL CHECK (gateway IN ('stripe','mercado_pago')),
  transaction_id text,
  payer_email text,
  payer_name text,
  product_type text,
  product_id text,
  status text NOT NULL DEFAULT 'unresolved',
  error_message text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wpl_resolved   ON public.webhook_purchase_logs (resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wpl_email      ON public.webhook_purchase_logs (payer_email);
CREATE INDEX IF NOT EXISTS idx_wpl_gateway_tx ON public.webhook_purchase_logs (gateway, transaction_id);

ALTER TABLE public.webhook_purchase_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage webhook_purchase_logs"
  ON public.webhook_purchase_logs
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_wpl_updated_at
  BEFORE UPDATE ON public.webhook_purchase_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();