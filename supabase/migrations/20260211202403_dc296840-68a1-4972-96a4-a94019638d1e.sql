ALTER TABLE public.upsell_settings 
ADD COLUMN enrollment_days_trigger integer NOT NULL DEFAULT 10;