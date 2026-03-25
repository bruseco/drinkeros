
-- 1. Add agent_type to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS agent_type text DEFAULT NULL;

-- 2. Add agent_templates JSONB to whatsapp_agent_settings
ALTER TABLE public.whatsapp_agent_settings
ADD COLUMN IF NOT EXISTS agent_templates jsonb DEFAULT '{
  "cs": ["welcome_new", "welcome_existing", "onboarding_followup", "study_reminder"],
  "ascensao": ["upsell_1", "upsell_2", "upsell_3", "upsell_4", "ascensao_recomendacao"],
  "recuperacao": ["crm_recovery_carrinho_1", "crm_recovery_carrinho_2", "crm_recovery_pix", "crm_recovery_cartao"],
  "suporte": ["reabertura_atendimento"]
}'::jsonb;

-- 3. Add index for agent_type filtering
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_agent_type 
ON public.whatsapp_conversations(agent_type) WHERE agent_type IS NOT NULL;
