
-- Table: crm_leads
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  stage text NOT NULL DEFAULT 'carrinho_abandonado_1',
  product_name text,
  product_id text,
  product_type text,
  sale_value numeric,
  source text NOT NULL DEFAULT 'manual',
  assigned_to uuid,
  profile_id uuid,
  recovery_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  lost_reason text,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage crm_leads" ON public.crm_leads FOR ALL USING (is_admin(auth.uid()));

CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: crm_lead_activities
CREATE TABLE public.crm_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'note',
  description text NOT NULL,
  created_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage crm_lead_activities" ON public.crm_lead_activities FOR ALL USING (is_admin(auth.uid()));

-- Table: crm_lead_tasks
CREATE TABLE public.crm_lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date timestamptz NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_lead_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage crm_lead_tasks" ON public.crm_lead_tasks FOR ALL USING (is_admin(auth.uid()));

-- Index for performance
CREATE INDEX idx_crm_leads_stage ON public.crm_leads(stage);
CREATE INDEX idx_crm_leads_assigned_to ON public.crm_leads(assigned_to);
CREATE INDEX idx_crm_lead_activities_lead_id ON public.crm_lead_activities(lead_id);
CREATE INDEX idx_crm_lead_tasks_lead_id ON public.crm_lead_tasks(lead_id);
CREATE INDEX idx_crm_lead_tasks_due_date ON public.crm_lead_tasks(due_date) WHERE completed = false;
