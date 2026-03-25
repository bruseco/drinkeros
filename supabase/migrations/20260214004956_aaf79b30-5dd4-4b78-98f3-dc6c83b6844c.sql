
-- Create whatsapp_template_bindings table
CREATE TABLE public.whatsapp_template_bindings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.zapi_connections(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  process text NOT NULL,
  variable_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(connection_id, process)
);

-- Enable RLS
ALTER TABLE public.whatsapp_template_bindings ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage template bindings"
ON public.whatsapp_template_bindings
FOR ALL
USING (is_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_whatsapp_template_bindings_updated_at
BEFORE UPDATE ON public.whatsapp_template_bindings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
