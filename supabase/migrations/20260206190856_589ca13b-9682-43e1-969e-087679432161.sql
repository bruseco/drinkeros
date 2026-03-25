
-- Create onboarding reminder settings table
CREATE TABLE public.onboarding_reminder_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  inactive_days INTEGER NOT NULL DEFAULT 3,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_reminder_settings ENABLE ROW LEVEL SECURITY;

-- Policies: only super admins
CREATE POLICY "Super admins can view onboarding reminder settings"
  ON public.onboarding_reminder_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update onboarding reminder settings"
  ON public.onboarding_reminder_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Insert default settings
INSERT INTO public.onboarding_reminder_settings (is_enabled, inactive_days)
VALUES (true, 3);

-- Create trigger for updated_at
CREATE TRIGGER update_onboarding_reminder_settings_updated_at
  BEFORE UPDATE ON public.onboarding_reminder_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert onboarding reminder email template
INSERT INTO public.email_templates (slug, name, subject, description, available_variables, html_body)
VALUES (
  'onboarding-reminder',
  'Lembrete de Onboarding',
  '📚 Seu curso está esperando por você!',
  'Enviado automaticamente para novos alunos que não acessaram o conteúdo após o cadastro',
  ARRAY['user_name', 'email', 'inactive_days', 'login_url'],
  '<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: sans-serif; background: #0a0a0a; padding: 40px 16px;">
  <div style="max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 16px; padding: 40px; color: #f5f5f5;">
    <h1 style="color: #ffffff; margin-bottom: 24px;">📚 Seu curso está esperando por você!</h1>
    <p style="font-size: 16px; line-height: 1.6;">Olá, <strong>{{user_name}}</strong>!</p>
    <p style="font-size: 16px; line-height: 1.6; color: #d4d4d4;">Notamos que você se cadastrou há {{inactive_days}} dias mas ainda não acessou nenhuma aula. Seu conteúdo está pronto e esperando por você!</p>
    <p style="font-size: 16px; line-height: 1.6; color: #d4d4d4;">Não perca tempo — comece agora mesmo e aproveite todo o material disponível.</p>
    <a href="{{login_url}}" style="display: inline-block; margin-top: 20px; padding: 14px 28px; background: #dc2626; color: #ffffff; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Acessar minhas aulas</a>
    <p style="color: #a3a3a3; font-size: 13px; margin-top: 32px;">Se precisar de ajuda, basta responder este email.</p>
  </div>
</body></html>'
);
