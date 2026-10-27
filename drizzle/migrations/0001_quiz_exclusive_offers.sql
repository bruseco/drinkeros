-- Exclusive quiz pricing. Original product prices and public Club offers are untouched.
CREATE TABLE public.quiz_offer_prices (
 product text PRIMARY KEY, product_type text NOT NULL CHECK(product_type IN ('course','combo','club')),
 slug text NOT NULL, full_price numeric(10,2) NOT NULL CHECK(full_price>0),
 quiz_price numeric(10,2) NOT NULL CHECK(quiz_price>0 AND quiz_price<full_price), active boolean NOT NULL DEFAULT true,
 UNIQUE(product_type,slug)
);
INSERT INTO public.quiz_offer_prices(product,product_type,slug,full_price,quiz_price) VALUES
 ('pack','combo','pacote-6-e-books',147,47),('clube','club','clube-anual',97,87),
 ('xperience','course','drinkeros-xperience',497,197),('bordo','course','bartender-a-bordo',397,147),
 ('delivery','course','drinkdelivery-engarrafados',397,147),('mixologia','course','mixologia-avancada',797,297),
 ('eventos','course','bar-p-eventos',697,227);
CREATE TABLE public.quiz_offer_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 path text NOT NULL CHECK(path IN ('casa','profissional','empreender')), recommended text NOT NULL REFERENCES public.quiz_offer_prices(product),
 answers jsonb NOT NULL, attribution jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 arrived_at timestamptz, expires_at timestamptz, CHECK(expires_at IS NULL OR expires_at=arrived_at+interval '20 minutes')
);
CREATE TABLE public.quiz_payment_attributions (
 gateway text NOT NULL CHECK(gateway IN ('mercado_pago','stripe')), transaction_id text NOT NULL,
 session_id uuid NOT NULL REFERENCES public.quiz_offer_sessions(id), product text NOT NULL REFERENCES public.quiz_offer_prices(product),
 product_id text NOT NULL, amount numeric(10,2) NOT NULL, path text NOT NULL, attribution jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(gateway,transaction_id)
);
ALTER TABLE public.quiz_offer_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_offer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_payment_attributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_offer_prices,public.quiz_offer_sessions,public.quiz_payment_attributions FROM anon,authenticated;
GRANT ALL ON public.quiz_offer_prices,public.quiz_offer_sessions,public.quiz_payment_attributions TO service_role;

CREATE FUNCTION public.quiz_complete(_hash text,_path text,_product text,_answers jsonb,_attribution jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 INSERT INTO public.quiz_offer_sessions(token_hash,path,recommended,answers,attribution)
 VALUES(_hash,_path,_product,_answers,_attribution)
 ON CONFLICT(token_hash) DO UPDATE SET path=excluded.path,recommended=excluded.recommended,answers=excluded.answers RETURNING id INTO result;
 RETURN result; -- Retaking may change the recommendation; original attribution and the deadline never reset.
END;$$;

CREATE FUNCTION public.quiz_quote(_hash text,_product text,_activate boolean DEFAULT false)
RETURNS TABLE(session_id uuid,path text,recommended text,product text,price numeric,full_price numeric,expires_at timestamptz,server_now timestamptz,active boolean,attribution jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
 RETURN QUERY SELECT s.id,s.path,s.recommended,p.product,CASE WHEN s.expires_at>t THEN p.quiz_price ELSE p.full_price END,p.full_price,s.expires_at,t,s.expires_at>t,s.attribution;
END;$$;
REVOKE ALL ON FUNCTION public.quiz_complete(text,text,text,jsonb,jsonb),public.quiz_quote(text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_complete(text,text,text,jsonb,jsonb),public.quiz_quote(text,text,boolean) TO service_role;

-- Add attribution without touching Purchase/CAPI control fields or webhook logic.
CREATE FUNCTION public.quiz_purchase_attribution() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a record;
BEGIN
 SELECT qa.*,p.product_type INTO a
 FROM public.quiz_payment_attributions qa JOIN public.quiz_offer_sessions s ON s.id=qa.session_id JOIN public.quiz_offer_prices p ON p.product=qa.product
 WHERE qa.gateway=NEW.gateway AND (qa.transaction_id=NEW.transaction_id OR (NEW.gateway='stripe' AND qa.transaction_id=NEW.metadata->>'session_id'))
 AND (qa.product_id=NEW.product_id::text OR (NEW.product_type='club' AND NEW.product_id IS NULL)) AND p.product_type=NEW.product_type AND qa.amount=NEW.amount_paid LIMIT 1;
 IF FOUND THEN
  NEW.metadata:=coalesce(NEW.metadata,'{}'::jsonb)||a.attribution||jsonb_build_object('quiz_session_id',a.session_id,'quiz_path',a.path,'quiz_product',a.product);
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER quiz_purchase_attribution BEFORE INSERT OR UPDATE OF status,amount_paid,transaction_id ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.quiz_purchase_attribution();
-- Reconcile attribution when a webhook arrives before payment creation returns.
CREATE FUNCTION public.quiz_reconcile_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.purchases p SET metadata=coalesce(p.metadata,'{}'::jsonb)||NEW.attribution||jsonb_build_object('quiz_session_id',s.id,'quiz_path',NEW.path,'quiz_product',NEW.product)
 FROM public.quiz_offer_sessions s,public.quiz_offer_prices o
 WHERE s.id=NEW.session_id AND o.product=NEW.product AND p.gateway=NEW.gateway
 AND (p.transaction_id=NEW.transaction_id OR (NEW.gateway='stripe' AND p.metadata->>'session_id'=NEW.transaction_id))
 AND (p.product_id::text=NEW.product_id OR (p.product_type='club' AND p.product_id IS NULL)) AND p.product_type=o.product_type AND p.amount_paid=NEW.amount;
 RETURN NEW;
END;$$;
CREATE TRIGGER quiz_reconcile_payment AFTER INSERT ON public.quiz_payment_attributions FOR EACH ROW EXECUTE FUNCTION public.quiz_reconcile_payment();

CREATE TABLE public.quiz_payment_attempts (
 attempt_id uuid NOT NULL DEFAULT gen_random_uuid(),
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'), session_id uuid NOT NULL REFERENCES public.quiz_offer_sessions(id),
 product text NOT NULL REFERENCES public.quiz_offer_prices(product), amount numeric(10,2) NOT NULL,
 mp_id text, external_reference text, status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','accepted','failed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_payment_attempts FROM anon,authenticated;
GRANT ALL ON public.quiz_payment_attempts TO service_role;
CREATE FUNCTION public.quiz_claim_payment(_hash text,_session uuid,_product text,_amount numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO public.quiz_payment_attempts(token_hash,session_id,product,amount) VALUES(_hash,_session,_product,_amount) ON CONFLICT DO NOTHING;
 RETURN FOUND;
END;$$;
REVOKE ALL ON FUNCTION public.quiz_claim_payment(text,uuid,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_claim_payment(text,uuid,text,numeric) TO service_role;
