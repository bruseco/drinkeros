-- Campaign disabled until payment functions and UI have been installed and verified.
CREATE TABLE IF NOT EXISTS public.black80_campaign (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 enabled boolean NOT NULL DEFAULT false
);
ALTER TABLE public.black80_campaign ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.black80_campaign FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.black80_campaign TO service_role;
INSERT INTO public.black80_campaign(id,enabled) VALUES(true,false) ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.black80_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce((SELECT enabled FROM public.black80_campaign WHERE id),false)
 AND now()>='2026-11-26T00:00:00-03:00'::timestamptz
 AND now()<'2026-12-06T00:00:00-03:00'::timestamptz;
$$;
REVOKE ALL ON FUNCTION public.black80_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.black80_active() TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.public_black80_campaign()
RETURNS TABLE(enabled boolean,server_now timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.black80_active(),now();
$$;
REVOKE ALL ON FUNCTION public.public_black80_campaign() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_black80_campaign() TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.black80_price(_type text,_slug text,_base numeric,_current numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE
 WHEN NOT public.black80_active() OR _slug='rand' THEN _current
 WHEN _type='club' AND _slug='clube-anual' THEN least(_current,47)
 WHEN _type IN ('course','ebook','combo','package') AND _base>0 THEN least(_current,round(_base*0.2,2))
 ELSE _current END;
$$;
REVOKE ALL ON FUNCTION public.black80_price(text,text,numeric,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.black80_price(text,text,numeric,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.clube_public_checkout_quote(_user_id uuid)
 RETURNS TABLE(server_now timestamp with time zone, expires_at timestamp with time zone, price numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_now timestamptz := clock_timestamp(); v_expiry timestamptz; v_birth date; v_price numeric :=197;
BEGIN
  IF public.black80_active() THEN RETURN QUERY SELECT v_now,'2026-12-06T00:00:00-03:00'::timestamptz,47::numeric; RETURN; END IF;
  SELECT o.expires_at INTO v_expiry FROM public.clube_public_offers o WHERE o.user_id=_user_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_expiry>v_now THEN
    v_price:=87;
    SELECT p.birth_date INTO v_birth FROM public.profiles p WHERE p.user_id=_user_id LIMIT 1;
    IF date_part('year',age(v_now::date,v_birth)) BETWEEN 14 AND 24 THEN v_price:=47; END IF;
  END IF;
  RETURN QUERY SELECT v_now,v_expiry,v_price;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clube_public_offer(_token text, _reveal boolean DEFAULT false, _new_visit boolean DEFAULT false)
 RETURNS TABLE(server_now timestamp with time zone, revealed_at timestamp with time zone, expires_at timestamp with time zone, price numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    v_price := 87;
    IF v_user IS NOT NULL THEN
      SELECT p.birth_date INTO v_birth FROM public.profiles p WHERE p.user_id=v_user LIMIT 1;
      IF date_part('year',age(v_now::date,v_birth)) BETWEEN 14 AND 24 THEN v_price := 47; END IF;
    END IF;
  END IF;
  IF public.black80_active() THEN v_price:=47; END IF;
  RETURN QUERY SELECT v_now,v_row.revealed_at,v_row.expires_at,v_price;
END;
$function$;

CREATE OR REPLACE FUNCTION public.quiz_quote(_hash text, _product text, _activate boolean DEFAULT false)
 RETURNS TABLE(session_id uuid, path text, recommended text, product text, price numeric, full_price numeric, expires_at timestamp with time zone, server_now timestamp with time zone, active boolean, attribution jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE s public.quiz_offer_sessions%ROWTYPE; p public.quiz_offer_prices%ROWTYPE; t timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO s FROM public.quiz_offer_sessions WHERE token_hash=_hash FOR UPDATE;
 t:=clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'Conclua o quiz para acessar esta oferta'; END IF;
 IF NOT (_product=s.recommended OR (s.path<>'casa' AND _product='clube') OR (s.path='casa' AND ((s.recommended='xperience' AND _product='clube') OR (s.recommended='clube' AND _product='pack')))) THEN
  RAISE EXCEPTION 'Produto não pertence a este resultado';
 END IF;
 SELECT * INTO p FROM public.quiz_offer_prices q WHERE q.product=_product AND q.active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Oferta indisponível'; END IF;
 IF s.arrived_at IS NULL AND _activate THEN
  UPDATE public.quiz_offer_sessions SET arrived_at=t,expires_at=t+interval '20 minutes' WHERE id=s.id RETURNING * INTO s;
 END IF;
 IF s.expires_at IS NULL THEN RAISE EXCEPTION 'Abra a página da oferta antes do checkout'; END IF;
 RETURN QUERY SELECT s.id,s.path,s.recommended,p.product,public.black80_price(p.product_type,p.slug,p.full_price,CASE WHEN s.expires_at>t THEN p.quiz_price ELSE p.full_price END),p.full_price,s.expires_at,t,s.expires_at>t,s.attribution;
END;$function$;

