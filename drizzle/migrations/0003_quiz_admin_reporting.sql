-- Admin reporting reads only explicitly attributed purchases; historical sales stay unassigned.
CREATE FUNCTION public.quiz_admin_metrics(_since timestamptz DEFAULT NULL,_until timestamptz DEFAULT NULL)
RETURNS TABLE(path text,product text,event text,count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT coalesce(public.is_admin(auth.uid()),false) THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT e.metadata->>'path',coalesce(e.metadata->>'product',''),e.event,count(DISTINCT e.session_id)::bigint
 FROM public.page_funnel_events e WHERE ((e.page_key='quiz' AND e.event IN ('quiz_p1_answered','quiz_p2_answered','quiz_p3_answered','quiz_result')) OR e.page_key LIKE 'quiz-offer-%') AND e.event IN ('quiz_p1_answered','quiz_p2_answered','quiz_p3_answered','quiz_result','quiz_offer_viewed','quiz_checkout_clicked','quiz_checkout_viewed','quiz_lead_captured','quiz_discount_expired')
 AND (_since IS NULL OR e.created_at>=_since) AND (_until IS NULL OR e.created_at<_until)
 GROUP BY e.metadata->>'path',coalesce(e.metadata->>'product',''),e.event
 UNION ALL
 SELECT p.metadata->>'quiz_path',p.metadata->>'quiz_product','quiz_purchase',count(DISTINCT p.id)::bigint
 FROM public.purchases p WHERE p.status IN ('paid','approved') AND p.metadata->>'quiz_session_id' IS NOT NULL
 AND (_since IS NULL OR p.created_at>=_since) AND (_until IS NULL OR p.created_at<_until)
 GROUP BY p.metadata->>'quiz_path',p.metadata->>'quiz_product';
END;$$;
REVOKE ALL ON FUNCTION public.quiz_admin_metrics(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quiz_admin_metrics(timestamptz,timestamptz) TO authenticated;

CREATE FUNCTION public.quiz_admin_leads(_since timestamptz DEFAULT NULL,_until timestamptz DEFAULT NULL,_path text DEFAULT NULL,_product text DEFAULT NULL,_purchased boolean DEFAULT NULL,_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,name text,phone text,path text,product text,displayed_price numeric,consent_at timestamptz,answers jsonb,attribution jsonb,created_at timestamptz,purchased boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT coalesce(public.is_admin(auth.uid()),false) THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 RETURN QUERY WITH leads(id,name,phone,path,product,sale_value,consent_at,answers,attribution,created_at,purchased) AS (
 SELECT c.id,c.name,c.phone,c.metadata->>'quiz_path',l.product,c.sale_value,l.consent_at,c.metadata->'answers',c.metadata->'attribution',c.created_at,
 EXISTS(SELECT 1 FROM public.purchases p WHERE p.metadata->>'quiz_session_id'=s.id::text AND p.metadata->>'quiz_product'=l.product AND p.status IN ('approved','paid')) AS purchased
 FROM public.quiz_captured_leads l JOIN public.quiz_offer_sessions s ON s.id=l.session_id JOIN public.crm_leads c ON c.id=l.crm_lead_id
 WHERE (_since IS NULL OR c.created_at>=_since) AND (_until IS NULL OR c.created_at<_until)
 AND (_path IS NULL OR c.metadata->>'quiz_path'=_path) AND (_product IS NULL OR l.product=_product))
 SELECT * FROM leads l WHERE (_purchased IS NULL OR l.purchased=_purchased) ORDER BY l.created_at DESC LIMIT 100 OFFSET greatest(0,least(_offset,100000));
END;$$;
REVOKE ALL ON FUNCTION public.quiz_admin_leads(timestamptz,timestamptz,text,text,boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quiz_admin_leads(timestamptz,timestamptz,text,text,boolean,integer) TO authenticated;

CREATE FUNCTION public.quiz_admin_answers(_since timestamptz DEFAULT NULL,_until timestamptz DEFAULT NULL,_path text DEFAULT NULL)
RETURNS TABLE(question text,answer text,path text,count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT coalesce(public.is_admin(auth.uid()),false) THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT e.metadata->>'question',e.metadata->>'answer',e.metadata->>'path',count(DISTINCT e.session_id)::bigint
 FROM public.page_funnel_events e WHERE e.page_key='quiz' AND e.event IN ('quiz_p1_answered','quiz_p2_answered','quiz_p3_answered')
 AND (_since IS NULL OR e.created_at>=_since) AND (_until IS NULL OR e.created_at<_until) AND (_path IS NULL OR e.metadata->>'path'=_path)
 GROUP BY e.metadata->>'question',e.metadata->>'answer',e.metadata->>'path';
END;$$;
REVOKE ALL ON FUNCTION public.quiz_admin_answers(timestamptz,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quiz_admin_answers(timestamptz,timestamptz,text) TO authenticated;
