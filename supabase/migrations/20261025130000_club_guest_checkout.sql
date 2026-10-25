-- Capability-protected guest checkout. No anonymous account/session is created.
CREATE TABLE public.club_guest_checkouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text UNIQUE NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 email text NOT NULL,
 method text NOT NULL CHECK(method IN ('card','pix')),
 amount numeric NOT NULL CHECK(amount IN (97,197)),
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','pending','failed')),
 mp_id text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_checked_at timestamptz,
 activation_claimed_at timestamptz,
 CHECK(email=lower(trim(email)))
);
ALTER TABLE public.club_guest_checkouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_guest_checkouts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.club_guest_checkouts TO service_role;

CREATE FUNCTION public.claim_club_guest_checkout(_hash text,_email text,_method text,_amount numeric)
RETURNS TABLE(id uuid,claimed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF _hash !~ '^[a-f0-9]{64}$' OR _email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(trim(_email)),937));
 IF NOT EXISTS(SELECT 1 FROM public.club_guest_checkouts c WHERE c.token_hash=_hash) AND EXISTS(
  SELECT 1 FROM public.club_guest_checkouts c WHERE c.email=lower(trim(_email)) AND c.status<>'failed' AND c.created_at>clock_timestamp()-interval '24 hours'
 ) THEN RAISE EXCEPTION 'Já existe uma tentativa em andamento para este e-mail. Continue na tela original ou fale com o atendimento.'; END IF;
 INSERT INTO public.club_guest_checkouts(token_hash,email,method,amount)
 VALUES(_hash,lower(trim(_email)),_method,_amount)
 ON CONFLICT(token_hash) DO NOTHING RETURNING club_guest_checkouts.id INTO v_id;
 IF v_id IS NOT NULL THEN RETURN QUERY SELECT v_id,true; RETURN; END IF;
 SELECT c.id INTO v_id FROM public.club_guest_checkouts c WHERE c.token_hash=_hash;
 RETURN QUERY SELECT v_id,false;
END;$$;
REVOKE ALL ON FUNCTION public.claim_club_guest_checkout(text,text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_club_guest_checkout(text,text,text,numeric) TO service_role;

-- Replayed gateway notifications must never turn a newly-created guest account
-- into an existing account, or lose the secure checkout binding.
CREATE FUNCTION public.preserve_guest_purchase_origin() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.metadata->>'guest_checkout_id' IS NOT NULL THEN
  NEW.metadata:=OLD.metadata || coalesce(NEW.metadata,'{}'::jsonb);
  NEW.user_was_created:=OLD.user_was_created OR NEW.user_was_created;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.preserve_guest_purchase_origin() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_guest_purchase_origin BEFORE UPDATE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.preserve_guest_purchase_origin();
