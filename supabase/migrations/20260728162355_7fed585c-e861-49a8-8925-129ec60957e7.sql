-- 1) ab_tests: métricas internas só para admin; roteamento via RPC pública limitada
DROP POLICY IF EXISTS "ab_tests public read" ON public.ab_tests;

CREATE POLICY "ab_tests admin read"
ON public.ab_tests FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

REVOKE SELECT ON public.ab_tests FROM anon;

CREATE OR REPLACE FUNCTION public.get_ab_test_config(_page_key text)
RETURNS TABLE (
  page_key text,
  original_path text,
  variant_path text,
  traffic_split_pct integer,
  status text,
  winner text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.page_key,
         t.original_path,
         t.variant_path,
         t.traffic_split_pct,
         t.status::text,
         t.winner::text
  FROM public.ab_tests t
  WHERE t.page_key = _page_key
    AND t.status IN ('active', 'finished')
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_ab_test_config(text) TO anon, authenticated;

-- 2) combo_courses / combo_ebooks: só a composição de combos ativos/à venda
DROP POLICY IF EXISTS "Anyone can view combo_courses" ON public.combo_courses;
CREATE POLICY "View combo_courses of visible combos"
ON public.combo_courses FOR SELECT
USING (
  public.can_edit(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.combos c
    WHERE c.id = combo_courses.combo_id
      AND (c.is_active OR c.is_available_for_sale)
  )
);

DROP POLICY IF EXISTS "Anyone can view combo_ebooks" ON public.combo_ebooks;
CREATE POLICY "View combo_ebooks of visible combos"
ON public.combo_ebooks FOR SELECT
USING (
  public.can_edit(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.combos c
    WHERE c.id = combo_ebooks.combo_id
      AND (c.is_active OR c.is_available_for_sale)
  )
);

-- 3) recipe_packages: exige login (sem exposição anônima)
DROP POLICY IF EXISTS "Users can view recipe_packages" ON public.recipe_packages;
CREATE POLICY "Authenticated users can view recipe_packages"
ON public.recipe_packages FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.recipe_packages FROM anon;