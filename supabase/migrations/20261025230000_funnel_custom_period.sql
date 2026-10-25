-- Add bounded reporting without changing existing preset RPC signatures or events.
CREATE OR REPLACE FUNCTION public.get_page_funnel_window(_page_key text,_since timestamptz DEFAULT NULL,_until timestamptz DEFAULT NULL)
RETURNS TABLE(event text,count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT coalesce(public.is_admin(auth.uid()) OR public.is_partner(auth.uid()),false) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT e.event,count(DISTINCT e.session_id)::bigint FROM public.page_funnel_events e
 WHERE e.page_key=_page_key AND (_since IS NULL OR e.created_at>=_since) AND (_until IS NULL OR e.created_at<_until)
 GROUP BY e.event;
END;$$;
REVOKE ALL ON FUNCTION public.get_page_funnel_window(text,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_page_funnel_window(text,timestamptz,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_quiz_answer_metrics_window(_since timestamptz DEFAULT NULL,_until timestamptz DEFAULT NULL)
RETURNS TABLE(question text,answer text,count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT coalesce(public.is_admin(auth.uid()),false) THEN
  RAISE EXCEPTION 'Acesso restrito à administração' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT substring(e.event from '^quiz_(q[1-4])_answered$'),e.metadata->>'answer',count(DISTINCT e.session_id)::bigint
 FROM public.page_funnel_events e
 WHERE e.page_key='quiz' AND e.event IN ('quiz_q1_answered','quiz_q2_answered','quiz_q3_answered','quiz_q4_answered')
 AND (_since IS NULL OR e.created_at>=_since) AND (_until IS NULL OR e.created_at<_until)
 GROUP BY e.event,e.metadata->>'answer';
END;$$;
REVOKE ALL ON FUNCTION public.get_quiz_answer_metrics_window(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_answer_metrics_window(timestamptz,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_page_funnel_sales_window(
  _product_type text,
  _product_slug text,
  _since timestamptz DEFAULT NULL,
  _min_amount numeric DEFAULT NULL,
  _max_amount numeric DEFAULT NULL,
  _until timestamptz DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_product_name text;
  v_count bigint;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_partner(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _product_type = 'combo' THEN
    SELECT id, name INTO v_product_id, v_product_name FROM public.combos WHERE slug = _product_slug;
  ELSIF _product_type = 'course' THEN
    SELECT id, title INTO v_product_id, v_product_name FROM public.courses WHERE slug = _product_slug;
  ELSIF _product_type = 'ebook' THEN
    SELECT id, title INTO v_product_id, v_product_name FROM public.ebooks WHERE slug = _product_slug;
  ELSIF _product_type = 'package' THEN
    SELECT id, title INTO v_product_id, v_product_name FROM public.packages WHERE slug = _product_slug;
  ELSE
    RETURN 0;
  END IF;

  IF v_product_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.purchases
  WHERE status = 'approved'
    AND product_type = _product_type
    AND (
      product_id = v_product_id::text
      OR (product_id IS NULL AND v_product_name IS NOT NULL AND lower(product_name) = lower(v_product_name))
    )
    AND (_since IS NULL OR created_at >= _since)
    AND (_until IS NULL OR created_at < _until)
    AND (_min_amount IS NULL OR amount_paid >= _min_amount)
    AND (_max_amount IS NULL OR amount_paid <= _max_amount);

  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_page_funnel_sales_window(text, text, timestamptz, numeric, numeric, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_page_funnel_sales_window(text, text, timestamptz, numeric, numeric, timestamptz) TO authenticated;
