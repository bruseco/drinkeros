-- Journey counts anchored on the quiz CTA in the selected period; historical clicks
-- can be classified by profile, but downstream visits are never inferred.
CREATE OR REPLACE FUNCTION public.get_quiz_destination_metrics(_since timestamptz DEFAULT NULL,_until timestamptz DEFAULT NULL)
RETURNS TABLE(destination text,clicks bigint,landing_views bigint,checkout_views bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT coalesce(public.is_admin(auth.uid()),false) THEN
  RAISE EXCEPTION 'Acesso restrito à administração' USING ERRCODE='42501';
 END IF;
 RETURN QUERY
 WITH targets(profile,path) AS (VALUES
  ('criador','/drinkeros-xperience'),('aspirante','/drinkeros-xperience'),
  ('profissional','/mixologia-avancada'),('empreendedor_delivery','/drinkdelivery-engarrafados'),
  ('empreendedor_eventos','/bar-p-eventos'),('aventureiro','/bartender-a-bordo')
 ), journeys AS (
  SELECT c.session_id,t.path,c.created_at,
   (SELECT min(l.created_at) FROM public.page_funnel_events l
    WHERE l.page_key='quiz' AND l.event='quiz_landing_viewed' AND l.session_id=c.session_id
    AND l.metadata->>'destination'=t.path AND l.metadata->>'profile'=t.profile
    AND l.created_at>=c.created_at AND l.created_at<c.created_at+interval '2 hours'
    AND (_until IS NULL OR l.created_at<_until)) AS landed_at
  FROM public.page_funnel_events c JOIN targets t ON t.profile=c.metadata->>'profile'
  WHERE c.page_key='quiz' AND c.event='quiz_cta_clicked'
  AND (_since IS NULL OR c.created_at>=_since) AND (_until IS NULL OR c.created_at<_until)
 )
 SELECT j.path,count(DISTINCT j.session_id),count(DISTINCT j.session_id) FILTER(WHERE j.landed_at IS NOT NULL),
  count(DISTINCT j.session_id) FILTER(WHERE j.landed_at IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.page_funnel_events e WHERE e.page_key='quiz' AND e.event='quiz_checkout_viewed'
   AND e.session_id=j.session_id AND e.metadata->>'destination'=j.path
   AND e.created_at>=j.landed_at AND e.created_at<j.created_at+interval '2 hours'
   AND (_until IS NULL OR e.created_at<_until)
  ))
 FROM journeys j GROUP BY j.path;
END;$$;
REVOKE ALL ON FUNCTION public.get_quiz_destination_metrics(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_destination_metrics(timestamptz,timestamptz) TO authenticated;
