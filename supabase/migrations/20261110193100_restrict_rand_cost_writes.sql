-- Supabase may apply default table grants on creation. Costs are writable only
-- through the validated superadmin RPC, even when those default grants exist.
REVOKE ALL ON public.rand_closing_costs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.rand_closing_costs TO authenticated;
GRANT ALL ON public.rand_closing_costs TO service_role;
