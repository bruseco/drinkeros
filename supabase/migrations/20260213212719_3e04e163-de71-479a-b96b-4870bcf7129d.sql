CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES zapi_connections(id) ON DELETE CASCADE,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'pt_BR',
  category text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  components jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(connection_id, name, language)
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage templates"
  ON public.whatsapp_templates FOR ALL
  USING (public.is_admin(auth.uid()));