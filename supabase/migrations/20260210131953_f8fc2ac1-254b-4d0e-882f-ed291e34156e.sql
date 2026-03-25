
-- Add agent mode columns to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS agent_mode text NOT NULL DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- Create whatsapp_agent_settings table
CREATE TABLE public.whatsapp_agent_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT false,
  system_prompt text NOT NULL DEFAULT 'Você é um atendente da Criminal Lab, plataforma de cursos de Direito Criminal. Converse de forma natural pelo WhatsApp, com tom humano, informal e profissional. Máximo 200 palavras por mensagem. Use emojis moderadamente.',
  escalation_keywords text[] NOT NULL DEFAULT ARRAY['atendente', 'humano', 'reclamação', 'reclamacao', 'problema grave', 'reembolso', 'cancelar assinatura', 'falar com pessoa', 'falar com alguem']::text[],
  auto_reply_delay_seconds integer NOT NULL DEFAULT 5,
  max_messages_per_conversation integer NOT NULL DEFAULT 50,
  business_context text NOT NULL DEFAULT 'A Criminal Lab é uma plataforma de cursos online focada em Direito Criminal (Penal, Processo Penal e Legislação Penal Especial). Oferecemos módulos e cursos completos para estudantes e profissionais do Direito.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default settings row
INSERT INTO public.whatsapp_agent_settings (id) VALUES (gen_random_uuid());

-- Enable RLS
ALTER TABLE public.whatsapp_agent_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_agent_settings
CREATE POLICY "Admins can manage whatsapp_agent_settings"
  ON public.whatsapp_agent_settings
  FOR ALL
  USING (is_admin(auth.uid()));

-- Enable realtime for conversations (to see agent_mode changes)
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_agent_settings;
