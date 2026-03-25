
-- Part 1: Add priority column to whatsapp_send_queue
ALTER TABLE public.whatsapp_send_queue ADD COLUMN priority integer NOT NULL DEFAULT 0;

-- Update existing welcome items to have highest priority
UPDATE public.whatsapp_send_queue SET priority = 10 WHERE context_type = 'welcome' AND status = 'pending';

-- Recreate claim function with priority ordering
CREATE OR REPLACE FUNCTION public.claim_whatsapp_queue_items(batch_size integer DEFAULT 5)
 RETURNS SETOF whatsapp_send_queue
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM whatsapp_send_queue
    WHERE status = 'pending'
      AND scheduled_at <= now()
    ORDER BY priority DESC, created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE whatsapp_send_queue q
  SET status = 'processing'
  FROM claimed c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$function$;

-- Part 3: Create cs_timeline_events table
CREATE TABLE public.cs_timeline_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  event_subtype text NOT NULL DEFAULT 'sent',
  user_id uuid,
  phone text,
  channel text NOT NULL DEFAULT 'whatsapp',
  summary text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cs_timeline_events ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write
CREATE POLICY "Admins can manage cs_timeline_events"
  ON public.cs_timeline_events
  FOR ALL
  USING (is_admin(auth.uid()));

-- Index for efficient querying
CREATE INDEX idx_cs_timeline_events_created_at ON public.cs_timeline_events (created_at DESC);
CREATE INDEX idx_cs_timeline_events_type ON public.cs_timeline_events (event_type);
CREATE INDEX idx_cs_timeline_events_phone ON public.cs_timeline_events (phone);
