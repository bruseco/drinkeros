
-- Create atomic function to claim queue items using FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_whatsapp_queue_items(batch_size integer DEFAULT 5)
RETURNS SETOF whatsapp_send_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM whatsapp_send_queue
    WHERE status = 'pending'
      AND scheduled_at <= now()
    ORDER BY created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE whatsapp_send_queue q
  SET status = 'processing'
  FROM claimed c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;

-- Create atomic function to claim welcome queue items using FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_whatsapp_welcome_items()
RETURNS SETOF whatsapp_welcome_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM whatsapp_welcome_queue
    WHERE processed = false
      AND scheduled_at <= now()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
  )
  UPDATE whatsapp_welcome_queue q
  SET processed = true
  FROM claimed c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;
