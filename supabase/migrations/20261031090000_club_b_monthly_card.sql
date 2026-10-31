-- New B subscriptions only. Existing annual attempts and subscriptions remain unchanged.
ALTER TABLE public.club_guest_checkouts ADD COLUMN billing_months integer NOT NULL DEFAULT 12;
ALTER TABLE public.club_guest_checkouts DROP CONSTRAINT club_guest_checkouts_amount_check;
ALTER TABLE public.club_guest_checkouts ADD CONSTRAINT club_guest_checkouts_amount_check CHECK(
 (billing_months=12 AND amount IN (87,97,197)) OR (billing_months=1 AND amount=7 AND method='card')
);
CREATE FUNCTION public.claim_club_monthly_checkout(_hash text,_email text)
RETURNS TABLE(id uuid,claimed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF _hash !~ '^[a-f0-9]{64}$' OR _email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(trim(_email)),937));
 IF NOT EXISTS(SELECT 1 FROM public.club_guest_checkouts c WHERE c.token_hash=_hash) AND EXISTS(
  SELECT 1 FROM public.club_guest_checkouts c WHERE c.email=lower(trim(_email)) AND c.status<>'failed' AND c.created_at>clock_timestamp()-interval '24 hours'
 ) THEN RAISE EXCEPTION 'Já existe uma tentativa em andamento para este e-mail. Continue na tela original ou fale com o atendimento.'; END IF;
 INSERT INTO public.club_guest_checkouts(token_hash,email,method,amount,billing_months)
 VALUES(_hash,lower(trim(_email)),'card',7,1)
 ON CONFLICT(token_hash) DO NOTHING RETURNING club_guest_checkouts.id INTO v_id;
 IF v_id IS NOT NULL THEN RETURN QUERY SELECT v_id,true; RETURN; END IF;
 SELECT c.id INTO v_id FROM public.club_guest_checkouts c WHERE c.token_hash=_hash;
 RETURN QUERY SELECT v_id,false;
END;$$;
REVOKE ALL ON FUNCTION public.claim_club_monthly_checkout(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_club_monthly_checkout(text,text) TO service_role;

-- Atomic extension: a monthly payment never shortens an annual/lifetime access.
CREATE FUNCTION public.grant_club_monthly_period(_user_id uuid,_start timestamptz,_end timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF _end<=_start OR _end>_start+interval '32 days' THEN RAISE EXCEPTION 'Período inválido'; END IF;
 INSERT INTO public.user_plans(user_id,plan,source,activated_at,expires_at)
 VALUES(_user_id,'vip','mercadopago',_start,_end)
 ON CONFLICT(user_id) DO UPDATE SET plan='vip',source='mercadopago',activated_at=EXCLUDED.activated_at,
 expires_at=greatest(user_plans.expires_at,EXCLUDED.expires_at)
 WHERE user_plans.plan::text NOT IN ('vitalicio') AND (user_plans.expires_at IS NOT NULL OR user_plans.plan::text='free');
END;$$;
REVOKE ALL ON FUNCTION public.grant_club_monthly_period(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.grant_club_monthly_period(uuid,timestamptz,timestamptz) TO service_role;
