-- 1) Club winners: restrict to club members / admins
DROP POLICY IF EXISTS "Anyone authenticated can view winners" ON public.club_monthly_winners;
CREATE POLICY "Club members can view winners"
ON public.club_monthly_winners
FOR SELECT
TO authenticated
USING (public.is_club_member(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone authenticated can view yearly winners" ON public.club_yearly_winners;
CREATE POLICY "Club members can view yearly winners"
ON public.club_yearly_winners
FOR SELECT
TO authenticated
USING (public.is_club_member(auth.uid()) OR public.is_admin(auth.uid()));

-- 2) redirect_links: no public read; expose only destination via SECURITY DEFINER fn
DROP POLICY IF EXISTS "Anyone can read redirect links" ON public.redirect_links;
REVOKE SELECT ON public.redirect_links FROM anon;

CREATE OR REPLACE FUNCTION public.resolve_redirect_link(link_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT destination_url
  FROM public.redirect_links
  WHERE code = link_code
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.resolve_redirect_link(text) TO anon, authenticated;

-- 3) recipe_packages: explicit WITH CHECK on editor management policy
DROP POLICY IF EXISTS "Admins can manage recipe_packages" ON public.recipe_packages;
CREATE POLICY "Admins can manage recipe_packages"
ON public.recipe_packages
FOR ALL
TO authenticated
USING (public.can_edit(auth.uid()))
WITH CHECK (public.can_edit(auth.uid()));