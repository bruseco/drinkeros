
-- Create webhook_logs table
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'woocommerce',
  product_id TEXT,
  product_name TEXT,
  email TEXT,
  phone TEXT,
  user_name TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  status_detail TEXT,
  user_id UUID,
  is_new_user BOOLEAN DEFAULT false,
  already_had_access BOOLEAN DEFAULT false,
  raw_payload JSONB,
  error_message TEXT,
  processing_time_ms INTEGER
);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view
CREATE POLICY "Admins can view webhook logs"
ON public.webhook_logs
FOR SELECT
USING (is_admin(auth.uid()));

-- Only admins can manage
CREATE POLICY "Admins can manage webhook logs"
ON public.webhook_logs
FOR ALL
USING (is_admin(auth.uid()));

-- Index for faster queries
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs (created_at DESC);
CREATE INDEX idx_webhook_logs_email ON public.webhook_logs (email);
CREATE INDEX idx_webhook_logs_status ON public.webhook_logs (status);
