DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vip_payments_stripe_payment_intent_id_key'
  ) THEN
    ALTER TABLE public.vip_payments
      ADD CONSTRAINT vip_payments_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vip_payments_stripe_invoice_id_key'
  ) THEN
    ALTER TABLE public.vip_payments
      ADD CONSTRAINT vip_payments_stripe_invoice_id_key UNIQUE (stripe_invoice_id);
  END IF;
END $$;