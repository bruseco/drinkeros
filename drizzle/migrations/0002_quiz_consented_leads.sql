CREATE TABLE public.quiz_captured_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES public.quiz_offer_sessions(id),
 product text NOT NULL REFERENCES public.quiz_offer_prices(product), crm_lead_id uuid NOT NULL REFERENCES public.crm_leads(id),
 consent_at timestamptz NOT NULL DEFAULT now(), consent_text text NOT NULL,
 event_id text NOT NULL UNIQUE DEFAULT ('quiz-lead:'||gen_random_uuid()::text), capi_sent_at timestamptz,
 UNIQUE(session_id,product)
);
ALTER TABLE public.quiz_captured_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_captured_leads FROM anon,authenticated;
GRANT ALL ON public.quiz_captured_leads TO service_role;
CREATE FUNCTION public.quiz_capture_lead(_hash text,_product text,_name text,_phone text,_consent boolean)
RETURNS TABLE(lead_id uuid,event_id text,capi_sent_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q record; existing public.quiz_captured_leads%ROWTYPE; crm uuid;
BEGIN
 IF _consent IS DISTINCT FROM true THEN RAISE EXCEPTION 'Consentimento obrigatório'; END IF;
 IF length(trim(_name)) NOT BETWEEN 2 AND 120 OR _phone !~ '^[0-9]{10,15}$' THEN RAISE EXCEPTION 'Confira nome e WhatsApp'; END IF;
 SELECT * INTO q FROM public.quiz_quote(_hash,_product,false);
 -- Lock the journey so simultaneous submissions cannot create two CRM records.
 PERFORM 1 FROM public.quiz_offer_sessions WHERE id=q.session_id FOR UPDATE;
 SELECT * INTO existing FROM public.quiz_captured_leads c WHERE c.session_id=q.session_id AND c.product=_product;
 IF FOUND THEN RETURN QUERY SELECT existing.crm_lead_id,existing.event_id,existing.capi_sent_at; RETURN; END IF;
 INSERT INTO public.crm_leads(name,phone,source,funnel,stage,product_type,product_name,sale_value,metadata)
 SELECT trim(_name),_phone,'quiz','quiz','quiz_novo',p.product_type,p.slug,q.price,
 jsonb_build_object('quiz_session_id',q.session_id,'quiz_path',q.path,'quiz_product',_product,'consent',true,'consent_at',clock_timestamp(),'consent_text','Aceito receber mensagens da Drinkeros pelo WhatsApp.','answers',s.answers,'displayed_price',q.price,'attribution',s.attribution)
 FROM public.quiz_offer_sessions s JOIN public.quiz_offer_prices p ON p.product=_product WHERE s.id=q.session_id RETURNING id INTO crm;
 INSERT INTO public.quiz_captured_leads(session_id,product,crm_lead_id,consent_text)
 VALUES(q.session_id,_product,crm,'Aceito receber mensagens da Drinkeros pelo WhatsApp.') RETURNING * INTO existing;
 RETURN QUERY SELECT crm,existing.event_id,existing.capi_sent_at;
END;$$;
REVOKE ALL ON FUNCTION public.quiz_capture_lead(text,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_capture_lead(text,text,text,text,boolean) TO service_role;

CREATE FUNCTION public.quiz_purchase_conversion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status IN ('paid','approved') AND NEW.metadata->>'quiz_session_id' IS NOT NULL THEN
  UPDATE public.crm_leads c SET stage='convertido',converted_at=coalesce(c.converted_at,now())
  FROM public.quiz_captured_leads l WHERE c.id=l.crm_lead_id AND l.session_id::text=NEW.metadata->>'quiz_session_id' AND l.product=NEW.metadata->>'quiz_product';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER quiz_purchase_conversion AFTER INSERT OR UPDATE OF status,metadata ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.quiz_purchase_conversion();
