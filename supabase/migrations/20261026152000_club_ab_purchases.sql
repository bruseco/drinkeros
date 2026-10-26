CREATE TABLE IF NOT EXISTS public.club_ab_attributions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 variant text NOT NULL CHECK (variant IN ('a','b')),
 guest_checkout_id uuid UNIQUE REFERENCES public.club_guest_checkouts(id),
 preapproval_id text UNIQUE,
 payment_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (num_nonnulls(guest_checkout_id,preapproval_id,payment_id)=1)
);
ALTER TABLE public.club_ab_attributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_ab_attributions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.club_ab_attributions TO service_role;

CREATE OR REPLACE FUNCTION public.get_club_ab_purchases(_since timestamptz DEFAULT NULL,_until timestamptz DEFAULT NULL)
RETURNS TABLE(variant text,purchases bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT coalesce(public.is_admin(auth.uid()) OR public.is_partner(auth.uid()),false) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 RETURN QUERY
 WITH first_payments AS (
  SELECT a.id,a.variant,p.created_at,
   row_number() OVER (PARTITION BY a.id ORDER BY p.created_at,p.id) AS position
  FROM public.club_ab_attributions a
  JOIN public.purchases p ON (
   (a.guest_checkout_id IS NOT NULL AND p.metadata->>'guest_checkout_id'=a.guest_checkout_id::text)
   OR (a.preapproval_id IS NOT NULL AND p.metadata->>'mp_preapproval_id'=a.preapproval_id)
   OR (a.payment_id IS NOT NULL AND p.transaction_id=a.payment_id)
  )
  WHERE p.gateway='mercado_pago' AND p.product_type='club'
   AND p.status IN ('approved','paid') AND p.amount_paid>0
 )
 SELECT variants.value,count(f.id) FROM (VALUES ('a'::text),('b'::text)) variants(value)
 LEFT JOIN first_payments f ON f.variant=variants.value AND f.position=1
  AND (_since IS NULL OR f.created_at>=_since) AND (_until IS NULL OR f.created_at<_until)
 GROUP BY variants.value;
END;$$;
REVOKE ALL ON FUNCTION public.get_club_ab_purchases(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_club_ab_purchases(timestamptz,timestamptz) TO authenticated;
