
-- Add funnel column to crm_leads
ALTER TABLE public.crm_leads ADD COLUMN funnel TEXT NOT NULL DEFAULT 'recovery';

-- Create index for performance
CREATE INDEX idx_crm_leads_funnel ON public.crm_leads (funnel);
