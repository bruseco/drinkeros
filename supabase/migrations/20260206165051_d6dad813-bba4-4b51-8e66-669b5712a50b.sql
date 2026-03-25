
-- Create email_settings table (singleton config)
CREATE TABLE public.email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_email text NOT NULL DEFAULT 'noreply@poderdelconocimiento.com',
  sender_name text NOT NULL DEFAULT 'Criminal Lab',
  reply_to_email text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admins can read/manage
CREATE POLICY "Super admins can view email settings"
ON public.email_settings FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage email settings"
ON public.email_settings FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Insert default row
INSERT INTO public.email_settings (sender_email, sender_name)
VALUES ('noreply@poderdelconocimiento.com', 'Criminal Lab');

-- Create email_templates table
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  description text,
  available_variables text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only super_admins can read/manage
CREATE POLICY "Super admins can view email templates"
ON public.email_templates FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage email templates"
ON public.email_templates FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_email_settings_updated_at
BEFORE UPDATE ON public.email_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.email_templates (slug, name, subject, html_body, description, available_variables)
VALUES (
  'welcome',
  'Email de Boas-vindas',
  '¡Bienvenido! Tu acceso está listo',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #0a0a0a;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #1a1a1a; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); border: 1px solid #2a2a2a;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 36px;">⚖️</span>
        </div>
        <h1 style="margin: 0; color: #f5f5f5; font-size: 28px; font-weight: 700;">¡Bienvenido, {{user_name}}!</h1>
      </div>
      
      <p style="color: #a3a3a3; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Tu cuenta ha sido creada con éxito. A continuación encontrarás tus datos de acceso:
      </p>
      
      <div style="background-color: #262626; border: 1px solid #3a3a3a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <p style="margin: 0 0 12px 0; color: #f5f5f5;">
          <strong>📧 Email:</strong> {{email}}
        </p>
        <p style="margin: 0; color: #f5f5f5;">
          <strong>🔐 Contraseña temporal:</strong> <code style="background-color: #3a3a3a; padding: 4px 8px; border-radius: 4px; font-family: monospace; color: #dc2626;">{{password}}</code>
        </p>
      </div>
      
      <p style="color: #737373; font-size: 14px; line-height: 1.6; margin-bottom: 32px;">
        ⚠️ <strong style="color: #a3a3a3;">Importante:</strong> Te recomendamos cambiar tu contraseña después de iniciar sesión por primera vez.
      </p>
      
      <div style="text-align: center;">
        <a href="{{login_url}}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Acceder a mi cuenta
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #2a2a2a; margin: 32px 0;">
      
      <p style="color: #525252; font-size: 12px; text-align: center; margin: 0;">
        Si no solicitaste esta cuenta, puedes ignorar este correo.
      </p>
    </div>
  </div>
</body>
</html>',
  'Email enviado quando um novo usuário é criado com senha temporária',
  ARRAY['{{user_name}}', '{{email}}', '{{password}}', '{{login_url}}']
);
