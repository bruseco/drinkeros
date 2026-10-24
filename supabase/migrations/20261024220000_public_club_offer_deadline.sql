-- Public landing only: one server deadline per browser offer, then per account.
CREATE TABLE public.clube_public_offers (
  token_hash text PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revealed_at timestamptz,
  expires_at timestamptz,
  CHECK ((revealed_at IS NULL AND expires_at IS NULL) OR (revealed_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at = revealed_at + interval '15 minutes'))
);
ALTER TABLE public.clube_public_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clube_public_offers FROM anon, authenticated;

CREATE FUNCTION public.clube_public_offer(_token text, _reveal boolean DEFAULT false, _new_visit boolean DEFAULT false)
RETURNS TABLE(server_now timestamptz, revealed_at timestamptz, expires_at timestamptz, price numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_hash text;
  v_row public.clube_public_offers%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_price numeric := 197;
  v_birth date;
BEGIN
  IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Identificador de oferta inválido'; END IF;
  v_hash := encode(sha256(convert_to(_token,'UTF8')),'hex');
  IF v_user IS NOT NULL THEN
    -- Serializes simultaneous claims across tabs/devices for this account.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text,0));
    SELECT o.* INTO v_row FROM public.clube_public_offers o WHERE o.user_id=v_user FOR UPDATE;
  END IF;
  IF v_row.token_hash IS NULL THEN
    INSERT INTO public.clube_public_offers(token_hash) VALUES(v_hash) ON CONFLICT DO NOTHING;
    SELECT o.* INTO v_row FROM public.clube_public_offers o WHERE o.token_hash=v_hash FOR UPDATE;
    IF v_row.user_id IS NOT NULL AND v_row.user_id IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION 'Oferta vinculada a outra conta';
    END IF;
    IF v_user IS NOT NULL THEN
      UPDATE public.clube_public_offers o SET user_id=v_user WHERE o.token_hash=v_hash RETURNING o.* INTO v_row;
    END IF;
  END IF;
  -- Returning to the landing after expiry may present a new offer. Polling,
  -- checkout and login within an active window never extend that deadline.
  IF _new_visit AND v_row.expires_at<=v_now THEN
    UPDATE public.clube_public_offers o SET revealed_at=NULL,expires_at=NULL
    WHERE o.token_hash=v_row.token_hash RETURNING o.* INTO v_row;
  END IF;
  IF _reveal AND v_row.revealed_at IS NULL THEN
    UPDATE public.clube_public_offers o SET revealed_at=v_now, expires_at=v_now+interval '15 minutes'
    WHERE o.token_hash=v_row.token_hash RETURNING o.* INTO v_row;
  END IF;
  IF v_row.expires_at>v_now THEN
    v_price := 97;
    IF v_user IS NOT NULL THEN
      SELECT p.birth_date INTO v_birth FROM public.profiles p WHERE p.user_id=v_user LIMIT 1;
      IF date_part('year',age(v_now::date,v_birth)) BETWEEN 14 AND 24 THEN v_price := 47; END IF;
    END IF;
  END IF;
  RETURN QUERY SELECT v_now,v_row.revealed_at,v_row.expires_at,v_price;
END;
$$;
REVOKE ALL ON FUNCTION public.clube_public_offer(text,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clube_public_offer(text,boolean,boolean) TO anon,authenticated;

-- Used only by payment functions after authenticating the account.
CREATE FUNCTION public.clube_public_checkout_quote(_user_id uuid)
RETURNS TABLE(server_now timestamptz, expires_at timestamptz, price numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_now timestamptz := clock_timestamp(); v_expiry timestamptz; v_birth date; v_price numeric :=197;
BEGIN
  SELECT o.expires_at INTO v_expiry FROM public.clube_public_offers o WHERE o.user_id=_user_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_expiry>v_now THEN
    v_price:=97;
    SELECT p.birth_date INTO v_birth FROM public.profiles p WHERE p.user_id=_user_id LIMIT 1;
    IF date_part('year',age(v_now::date,v_birth)) BETWEEN 14 AND 24 THEN v_price:=47; END IF;
  END IF;
  RETURN QUERY SELECT v_now,v_expiry,v_price;
END;
$$;
REVOKE ALL ON FUNCTION public.clube_public_checkout_quote(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clube_public_checkout_quote(uuid) TO service_role;

CREATE FUNCTION public.clube_public_account_quote()
RETURNS TABLE(server_now timestamptz, expires_at timestamptz, price numeric)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT * FROM public.clube_public_checkout_quote(auth.uid()) WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.clube_public_account_quote() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clube_public_account_quote() TO authenticated;
