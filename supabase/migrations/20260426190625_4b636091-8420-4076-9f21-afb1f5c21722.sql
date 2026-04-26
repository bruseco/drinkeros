-- 1. Tabela de controle de envios da régua de renovação
CREATE TABLE public.vip_renewal_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_plan_expires_at timestamptz NOT NULL,
  step text NOT NULL,
  channel text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  coupon_code text,
  CONSTRAINT vip_renewal_reminders_step_check
    CHECK (step IN ('m1','d10','d5','d3','d1','d0','dplus3')),
  CONSTRAINT vip_renewal_reminders_channel_check
    CHECK (channel IN ('email','whatsapp')),
  CONSTRAINT vip_renewal_reminders_unique
    UNIQUE (user_id, user_plan_expires_at, step, channel)
);

CREATE INDEX idx_vip_renewal_reminders_user ON public.vip_renewal_reminders(user_id);
CREATE INDEX idx_vip_renewal_reminders_step ON public.vip_renewal_reminders(step, sent_at DESC);

ALTER TABLE public.vip_renewal_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage renewal reminders"
ON public.vip_renewal_reminders
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users view own reminders"
ON public.vip_renewal_reminders
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Migrar user_exclusive_access (feature='receitas') para user_plans (Clube dos Drinkeros)
-- Apenas para quem AINDA NÃO tem plano vip ativo. Vitalício segue sem expiração via outro fluxo.
INSERT INTO public.user_plans (user_id, plan, activated_at, expires_at, source)
SELECT
  uea.user_id,
  'vip',
  uea.created_at,
  COALESCE(uea.expires_at, uea.created_at + interval '1 year'),
  'legacy_exclusive'
FROM public.user_exclusive_access uea
WHERE uea.feature = 'receitas'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_plans up
    WHERE up.user_id = uea.user_id
      AND up.plan = 'vip'
      AND (up.expires_at IS NULL OR up.expires_at > now())
  )
ON CONFLICT (user_id) DO UPDATE
  SET plan = 'vip',
      activated_at = LEAST(user_plans.activated_at, EXCLUDED.activated_at),
      expires_at = GREATEST(
        COALESCE(user_plans.expires_at, EXCLUDED.expires_at),
        EXCLUDED.expires_at
      ),
      source = CASE WHEN user_plans.plan = 'vip' THEN user_plans.source ELSE 'legacy_exclusive' END,
      updated_at = now();