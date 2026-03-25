
-- =============================================
-- Tabela: upsell_settings (configurações globais)
-- =============================================
CREATE TABLE public.upsell_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  progress_threshold integer NOT NULL DEFAULT 60,
  cooldown_days integer NOT NULL DEFAULT 15,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view upsell settings"
  ON public.upsell_settings FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update upsell settings"
  ON public.upsell_settings FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Insert default row
INSERT INTO public.upsell_settings (is_enabled, progress_threshold, cooldown_days)
VALUES (true, 60, 15);

-- Trigger para updated_at
CREATE TRIGGER update_upsell_settings_updated_at
  BEFORE UPDATE ON public.upsell_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Tabela: upsell_sequences (histórico por aluno)
-- =============================================
CREATE TABLE public.upsell_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_type text NOT NULL CHECK (product_type IN ('package', 'course')),
  product_id uuid NOT NULL,
  trigger_module_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  emails_sent integer NOT NULL DEFAULT 0,
  last_email_at timestamp with time zone,
  ai_generated_subject text,
  ai_generated_body text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view upsell sequences"
  ON public.upsell_sequences FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage upsell sequences"
  ON public.upsell_sequences FOR ALL
  USING (is_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_upsell_sequences_updated_at
  BEFORE UPDATE ON public.upsell_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_upsell_sequences_user_id ON public.upsell_sequences(user_id);
CREATE INDEX idx_upsell_sequences_status ON public.upsell_sequences(status);
CREATE INDEX idx_upsell_sequences_created_at ON public.upsell_sequences(created_at DESC);
