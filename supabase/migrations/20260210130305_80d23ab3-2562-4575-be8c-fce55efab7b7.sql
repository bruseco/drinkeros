-- Add WhatsApp columns to upsell_sequences
ALTER TABLE public.upsell_sequences 
  ADD COLUMN whatsapp_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN last_whatsapp_at timestamp with time zone;

-- Add channel column to upsell_email_logs
ALTER TABLE public.upsell_email_logs 
  ADD COLUMN channel text NOT NULL DEFAULT 'email';

-- Add whatsapp_enabled to upsell_settings
ALTER TABLE public.upsell_settings 
  ADD COLUMN whatsapp_enabled boolean NOT NULL DEFAULT false;