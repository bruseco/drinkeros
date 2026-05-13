CREATE TABLE IF NOT EXISTS public.nibo_service_mappings (
  product_type text PRIMARY KEY,
  nibo_service_id text NOT NULL,
  nibo_service_name text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.nibo_service_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage nibo_service_mappings"
ON public.nibo_service_mappings FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER nibo_service_mappings_updated_at
BEFORE UPDATE ON public.nibo_service_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();