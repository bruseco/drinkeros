
-- Create upsell_product_rules table
CREATE TABLE public.upsell_product_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_product_type text NOT NULL CHECK (trigger_product_type IN ('course', 'package')),
  trigger_product_id uuid NOT NULL,
  offer_product_type text NOT NULL CHECK (offer_product_type IN ('course', 'package')),
  offer_product_id uuid NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.upsell_product_rules ENABLE ROW LEVEL SECURITY;

-- Super admins can manage (full CRUD)
CREATE POLICY "Super admins can manage upsell_product_rules"
  ON public.upsell_product_rules
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- All admins can view
CREATE POLICY "Admins can view upsell_product_rules"
  ON public.upsell_product_rules
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Insert initial rule: Legislação Penal Especial → Dominando as Peças Criminais
INSERT INTO public.upsell_product_rules
  (trigger_product_type, trigger_product_id, offer_product_type, offer_product_id, priority, is_active)
VALUES
  ('course', '180fcbd7-92c5-44d9-a90a-1934d1feb7c3', 'course', '52ed8e17-ee9e-4a37-8032-e4395ead148e', 1, true);
