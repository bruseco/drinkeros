-- Serialize annual grants and recognize historical payments without changing access.
CREATE TABLE public.club_paid_period_grants (
 payment_id text PRIMARY KEY,
 user_id uuid NOT NULL,
 period_end timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.club_paid_period_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_paid_period_grants FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.club_paid_period_grants TO service_role;
INSERT INTO public.club_paid_period_grants(payment_id,user_id,period_end)
SELECT DISTINCT ON (ref) ref,user_id,period_end FROM public.vip_payments
CROSS JOIN LATERAL unnest(ARRAY[metadata->>'mercadopago_payment_id',metadata->>'mp_authorized_payment_id',metadata->>'purchase_transaction_id']) ref
WHERE ref IS NOT NULL AND ref<>''
ORDER BY ref,paid_at DESC NULLS LAST
ON CONFLICT DO NOTHING;

CREATE FUNCTION public.grant_club_annual_payment(_user_id uuid,_payment_id text,_paid_at timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE prior public.club_paid_period_grants%ROWTYPE; current_plan public.user_plans%ROWTYPE; new_end timestamptz; legacy_payment record;
BEGIN
 IF _user_id IS NULL OR _payment_id IS NULL OR btrim(_payment_id)='' OR _paid_at IS NULL THEN RAISE EXCEPTION 'Invalid annual payment'; END IF;
 -- Lock by payment and by account: retries and simultaneous distinct purchases are safe.
 PERFORM pg_advisory_xact_lock(hashtextextended('club-payment:'||_payment_id,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('club-user:'||_user_id::text,0));
 SELECT * INTO prior FROM public.club_paid_period_grants WHERE payment_id=_payment_id;
 IF FOUND THEN
  IF prior.user_id<>_user_id THEN RAISE EXCEPTION 'Payment belongs to another account'; END IF;
  RETURN prior.period_end;
 END IF;
 -- Also recognize a legacy payment recorded between migration and webhook deployment.
 SELECT user_id,period_end INTO legacy_payment FROM public.vip_payments
 WHERE _payment_id IN (metadata->>'mercadopago_payment_id',metadata->>'mp_authorized_payment_id',metadata->>'purchase_transaction_id')
 ORDER BY paid_at DESC NULLS LAST LIMIT 1;
 IF FOUND THEN
  IF legacy_payment.user_id<>_user_id THEN RAISE EXCEPTION 'Payment belongs to another account'; END IF;
  INSERT INTO public.club_paid_period_grants(payment_id,user_id,period_end) VALUES(_payment_id,_user_id,legacy_payment.period_end);
  RETURN legacy_payment.period_end;
 END IF;
 SELECT * INTO current_plan FROM public.user_plans WHERE user_id=_user_id FOR UPDATE;
 IF FOUND AND (current_plan.plan::text='vitalicio' OR (current_plan.plan::text='vip' AND current_plan.expires_at IS NULL)) THEN
  INSERT INTO public.club_paid_period_grants(payment_id,user_id,period_end) VALUES(_payment_id,_user_id,NULL);
  RETURN NULL;
 END IF;
 new_end:=greatest(_paid_at,CASE WHEN current_plan.plan::text='vip' THEN current_plan.expires_at ELSE NULL END)+interval '365 days';
 INSERT INTO public.user_plans(user_id,plan,source,activated_at,expires_at)
 VALUES(_user_id,'vip','mercadopago',_paid_at,new_end)
 ON CONFLICT(user_id) DO UPDATE SET plan='vip',source='mercadopago',expires_at=EXCLUDED.expires_at;
 INSERT INTO public.club_paid_period_grants(payment_id,user_id,period_end) VALUES(_payment_id,_user_id,new_end);
 RETURN new_end;
END;$$;
REVOKE ALL ON FUNCTION public.grant_club_annual_payment(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.grant_club_annual_payment(uuid,text,timestamptz) TO service_role;
