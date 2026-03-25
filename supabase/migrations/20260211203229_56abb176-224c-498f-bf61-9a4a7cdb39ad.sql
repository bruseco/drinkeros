
-- Create whatsapp_send_queue table
CREATE TABLE public.whatsapp_send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message text NOT NULL,
  context_type text NOT NULL DEFAULT 'upsell',
  context_data jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_send_queue ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage whatsapp_send_queue"
  ON public.whatsapp_send_queue
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- Index for queue processing
CREATE INDEX idx_whatsapp_send_queue_pending 
  ON public.whatsapp_send_queue (status, scheduled_at) 
  WHERE status = 'pending';
