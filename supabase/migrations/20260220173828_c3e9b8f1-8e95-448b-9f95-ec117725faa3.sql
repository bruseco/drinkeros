
-- Tabela de configurações de automação do CRM
CREATE TABLE public.crm_automation_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nurturing_enabled boolean NOT NULL DEFAULT false,
  nurturing_days integer NOT NULL DEFAULT 7,
  nurturing_stage text NOT NULL DEFAULT 'oferta_alternativa',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_automation_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admins can manage
CREATE POLICY "Super admins can view crm_automation_settings"
  ON public.crm_automation_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update crm_automation_settings"
  ON public.crm_automation_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed default row
INSERT INTO public.crm_automation_settings (nurturing_enabled, nurturing_days, nurturing_stage)
VALUES (false, 7, 'oferta_alternativa');

-- Trigger updated_at
CREATE TRIGGER update_crm_automation_settings_updated_at
  BEFORE UPDATE ON public.crm_automation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
