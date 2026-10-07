-- Dedicated read access; never grants an administrative or partner role.
CREATE TABLE public.rand_closing_viewers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rand_closing_viewers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rand_closing_viewers FROM anon, authenticated;
GRANT ALL ON public.rand_closing_viewers TO service_role;

CREATE FUNCTION public.can_view_rand_closing()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.rand_closing_viewers WHERE user_id = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION public.can_view_rand_closing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_rand_closing() TO authenticated;

CREATE FUNCTION public.view_rand_closings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_view_rand_closing() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(
    jsonb_build_object('month', c.month, 'status', c.status, 'draft_id', c.draft_id,
      'synced_at', c.synced_at, 'paid_at', c.paid_at, 'carried_to', c.carried_to,
      'report', c.report, 'buyer_names', COALESCE((
        SELECT jsonb_object_agg(names.payment_id, names.buyer_name) FROM (
          SELECT DISTINCT ON (line->>'payment_id') line->>'payment_id' AS payment_id,
            COALESCE(NULLIF(trim(p.buyer_name), ''), NULLIF(trim(pr.full_name), '')) AS buyer_name
          FROM jsonb_array_elements(c.report->'lines') line
          JOIN public.purchases p ON p.transaction_id = line->>'payment_id'
            AND p.gateway = 'mercado_pago' AND p.product_type = 'combo'
          LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
          ORDER BY line->>'payment_id', p.id
        ) names WHERE names.buyer_name IS NOT NULL
      ), '{}'::jsonb)) ORDER BY c.month DESC
  ) FROM public.rand_financial_closings c), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.view_rand_closings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.view_rand_closings() TO authenticated;
