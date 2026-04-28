-- Adiciona colunas para rastreio de pagamentos Mercado Pago
ALTER TABLE public.user_courses ADD COLUMN IF NOT EXISTS mercadopago_payment_id text;
ALTER TABLE public.user_ebooks ADD COLUMN IF NOT EXISTS mercadopago_payment_id text;
ALTER TABLE public.user_combos ADD COLUMN IF NOT EXISTS mercadopago_payment_id text;
ALTER TABLE public.user_packages ADD COLUMN IF NOT EXISTS mercadopago_payment_id text;

-- Tabela de logs/eventos do Mercado Pago para auditoria e webhooks
CREATE TABLE IF NOT EXISTS public.mercadopago_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payment_id text,
  preference_id text,
  external_reference text,
  status text,
  raw_payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_events_payment_id ON public.mercadopago_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_mp_events_external_ref ON public.mercadopago_events(external_reference);
CREATE INDEX IF NOT EXISTS idx_mp_events_processed ON public.mercadopago_events(processed) WHERE processed = false;

ALTER TABLE public.mercadopago_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view MP events"
ON public.mercadopago_events FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));