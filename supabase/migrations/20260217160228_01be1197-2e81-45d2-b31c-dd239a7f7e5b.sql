-- Enable RLS on whatsapp_welcome_queue (edge functions use service role key, bypassing RLS)
ALTER TABLE public.whatsapp_welcome_queue ENABLE ROW LEVEL SECURITY;

-- No user-facing policies needed: only edge functions (via service role) access this table