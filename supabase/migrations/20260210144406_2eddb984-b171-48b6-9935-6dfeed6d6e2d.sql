
CREATE TABLE public.whatsapp_welcome_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  email text NOT NULL,
  full_name text,
  product_name text,
  temporary_password text,
  is_new_user boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz NOT NULL DEFAULT (now() + interval '3 minutes'),
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_welcome_queue DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_whatsapp_welcome_queue_pending ON public.whatsapp_welcome_queue (scheduled_at) WHERE processed = false;
