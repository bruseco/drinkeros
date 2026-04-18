-- 1. vip_payments table
CREATE TABLE public.vip_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'paid', -- paid | pending | failed | refunded
  payment_method text NOT NULL DEFAULT 'card', -- card | pix | boleto | manual
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_invoice_id text,
  stripe_subscription_id text,
  stripe_customer_id text,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vip_payments_user_id ON public.vip_payments(user_id);
CREATE INDEX idx_vip_payments_status ON public.vip_payments(status);
CREATE INDEX idx_vip_payments_paid_at ON public.vip_payments(paid_at DESC);
CREATE UNIQUE INDEX idx_vip_payments_stripe_pi ON public.vip_payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX idx_vip_payments_stripe_invoice ON public.vip_payments(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

ALTER TABLE public.vip_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vip_payments"
ON public.vip_payments FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own vip_payments"
ON public.vip_payments FOR SELECT
USING (auth.uid() = user_id);

CREATE TRIGGER trg_vip_payments_updated_at
BEFORE UPDATE ON public.vip_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. user_plans.source column
ALTER TABLE public.user_plans
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN public.user_plans.source IS 'manual | stripe | webhook | hotmart | woocommerce';

-- 3. profiles.last_sign_in_provider column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_sign_in_provider text;

-- 4. Trigger to keep provider in sync from auth.users
CREATE OR REPLACE FUNCTION public.sync_last_sign_in_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE public.profiles
    SET last_sign_in_provider = COALESCE(
      NEW.raw_app_meta_data->>'provider',
      (NEW.raw_app_meta_data->'providers'->>0),
      'email'
    )
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_sign_in ON auth.users;
CREATE TRIGGER on_auth_user_sign_in
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_last_sign_in_provider();