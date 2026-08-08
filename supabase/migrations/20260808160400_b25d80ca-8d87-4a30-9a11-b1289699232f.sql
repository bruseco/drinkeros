
REVOKE EXECUTE ON FUNCTION public.get_zapi_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_zapi_credentials(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.select_zapi_connection(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.select_zapi_connection(uuid, boolean) TO service_role;

DROP POLICY IF EXISTS "Authenticated users can view recipe_packages" ON public.recipe_packages;
CREATE POLICY "View recipe_packages of accessible packages"
ON public.recipe_packages FOR SELECT TO authenticated
USING (
  public.can_edit(auth.uid())
  OR public.has_package_access(auth.uid(), package_id)
  OR EXISTS (SELECT 1 FROM public.packages p WHERE p.id = recipe_packages.package_id AND p.is_free)
);

DROP POLICY IF EXISTS "Anyone can view course_packages" ON public.course_packages;
CREATE POLICY "View course_packages of visible courses"
ON public.course_packages FOR SELECT TO authenticated
USING (
  public.can_edit(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_packages.course_id
      AND (c.is_active OR c.is_available_for_sale)
  )
);
REVOKE SELECT ON public.course_packages FROM anon;
REVOKE SELECT ON public.recipe_packages FROM anon;
