-- Read-only reporting: no payment, offer, deadline or purchase writes.
CREATE OR REPLACE FUNCTION public.quiz_admin_experiment(_since timestamptz DEFAULT NULL, _until timestamptz DEFAULT NULL)
RETURNS TABLE(variant text,path text,product text,event text,count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT coalesce(public.is_admin(auth.uid()),false) THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT CASE WHEN e.metadata->>'quiz_experiment'='quiz-art-v1' AND e.metadata->>'quiz_variant' IN ('a','b') THEN e.metadata->>'quiz_variant' ELSE 'unassigned' END,
 coalesce(e.metadata->>'path',''),coalesce(e.metadata->>'product',e.metadata->>'profile',''),e.event,count(DISTINCT e.session_id)::bigint
 FROM public.page_funnel_events e
 WHERE e.page_key='quiz' AND (_since IS NULL OR e.created_at>=_since) AND (_until IS NULL OR e.created_at<_until)
 GROUP BY 1,2,3,4
 UNION ALL
 SELECT coalesce(a.variant,'unassigned'),coalesce(p.metadata->>'quiz_path',''),coalesce(p.metadata->>'quiz_product',''),'quiz_purchase',count(DISTINCT p.id)::bigint
 FROM public.purchases p
 LEFT JOIN LATERAL (
   SELECT e.metadata->>'quiz_variant' AS variant
   FROM public.page_funnel_events e
   WHERE e.page_key='quiz' AND e.metadata->>'quiz_session_id'=p.metadata->>'quiz_session_id'
   AND e.metadata->>'quiz_experiment'='quiz-art-v1' AND e.metadata->>'quiz_variant' IN ('a','b')
   AND e.created_at<=p.created_at
   ORDER BY e.created_at ASC LIMIT 1
 ) a ON true
 WHERE p.status IN ('paid','approved') AND p.metadata->>'quiz_session_id' IS NOT NULL
 AND (_since IS NULL OR p.created_at>=_since) AND (_until IS NULL OR p.created_at<_until)
 GROUP BY 1,2,3;
END;$$;
REVOKE ALL ON FUNCTION public.quiz_admin_experiment(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quiz_admin_experiment(timestamptz,timestamptz) TO authenticated;
