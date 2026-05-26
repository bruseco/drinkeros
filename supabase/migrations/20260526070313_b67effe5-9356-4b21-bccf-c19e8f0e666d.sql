ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS emails_dispatched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_purchases_emails_dispatched
  ON public.purchases (gateway, transaction_id)
  WHERE emails_dispatched_at IS NULL;