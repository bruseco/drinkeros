CREATE TABLE IF NOT EXISTS public.partner_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  target_email text NOT NULL,
  product_type text NOT NULL,
  product_id uuid,
  product_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_access_grants TO authenticated;
GRANT ALL ON public.partner_access_grants TO service_role;

ALTER TABLE public.partner_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners view own grants" ON public.partner_access_grants
FOR SELECT TO authenticated
USING (partner_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS partner_access_grants_partner_idx ON public.partner_access_grants (partner_user_id, created_at DESC);