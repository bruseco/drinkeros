-- Aggregated quiz answers. Raw visitor/session data never leaves this RPC.
CREATE OR REPLACE FUNCTION public.get_quiz_answer_metrics(_since timestamptz DEFAULT NULL)
RETURNS TABLE(question text, answer text, count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT coalesce(public.is_admin(auth.uid()),false) THEN
  RAISE EXCEPTION 'Acesso restrito à administração' USING ERRCODE='42501';
 END IF;
 RETURN QUERY
 SELECT substring(e.event from '^quiz_(q[1-4])_answered$'), e.metadata->>'answer', count(DISTINCT e.session_id)::bigint
 FROM public.page_funnel_events e
 WHERE e.page_key='quiz'
  AND e.event IN ('quiz_q1_answered','quiz_q2_answered','quiz_q3_answered','quiz_q4_answered')
  AND (_since IS NULL OR e.created_at>=_since)
 GROUP BY e.event,e.metadata->>'answer';
END;$$;
REVOKE ALL ON FUNCTION public.get_quiz_answer_metrics(timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_answer_metrics(timestamptz) TO authenticated;
