CREATE OR REPLACE FUNCTION public.get_club_purchase_funnel(_since timestamptz DEFAULT NULL,_until timestamptz DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT coalesce(public.is_admin(auth.uid()) OR public.is_partner(auth.uid()),false) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 RETURN (SELECT count(*) FROM public.purchases p
  WHERE p.product_type='club' AND p.status IN ('approved','paid') AND p.amount_paid>0
   AND (_since IS NULL OR p.created_at>=_since) AND (_until IS NULL OR p.created_at<_until));
END;$$;
REVOKE ALL ON FUNCTION public.get_club_purchase_funnel(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_club_purchase_funnel(timestamptz,timestamptz) TO authenticated;
