
-- Create zapi_connections table
CREATE TABLE public.zapi_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  instance_id text NOT NULL,
  token text NOT NULL,
  security_token text NOT NULL,
  phone_number text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  daily_new_contact_limit integer NOT NULL DEFAULT 100,
  new_contacts_today integer NOT NULL DEFAULT 0,
  last_reset_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zapi_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage zapi_connections"
  ON public.zapi_connections FOR ALL
  USING (is_admin(auth.uid()));

-- Updated at trigger
CREATE TRIGGER update_zapi_connections_updated_at
  BEFORE UPDATE ON public.zapi_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add zapi_connection_id to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN zapi_connection_id uuid REFERENCES public.zapi_connections(id);

-- Add zapi_connection_id to whatsapp_send_queue for queue processor
ALTER TABLE public.whatsapp_send_queue
  ADD COLUMN zapi_connection_id uuid REFERENCES public.zapi_connections(id);

-- RPC: select_zapi_connection (atomic round-robin with limit)
CREATE OR REPLACE FUNCTION public.select_zapi_connection(p_conversation_id uuid DEFAULT NULL, p_is_new_contact boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_connection_id uuid;
  v_existing_connection_id uuid;
BEGIN
  -- If conversation already has a connection, return it
  IF p_conversation_id IS NOT NULL THEN
    SELECT zapi_connection_id INTO v_existing_connection_id
    FROM whatsapp_conversations
    WHERE id = p_conversation_id;
    
    IF v_existing_connection_id IS NOT NULL THEN
      RETURN v_existing_connection_id;
    END IF;
  END IF;

  -- Reset counters for connections whose last_reset_at is not today
  UPDATE zapi_connections
  SET new_contacts_today = 0, last_reset_at = CURRENT_DATE
  WHERE last_reset_at < CURRENT_DATE;

  IF p_is_new_contact THEN
    -- Select connection with lowest usage that hasn't hit limit, with lock
    SELECT id INTO v_connection_id
    FROM zapi_connections
    WHERE is_active = true
      AND new_contacts_today < daily_new_contact_limit
    ORDER BY new_contacts_today ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_connection_id IS NULL THEN
      RAISE EXCEPTION 'DAILY_LIMIT_REACHED: All connections have reached their daily new contact limit';
    END IF;

    -- Increment counter
    UPDATE zapi_connections
    SET new_contacts_today = new_contacts_today + 1
    WHERE id = v_connection_id;
  ELSE
    -- For existing contacts, just pick any active connection without counting
    SELECT id INTO v_connection_id
    FROM zapi_connections
    WHERE is_active = true
    ORDER BY new_contacts_today ASC, created_at ASC
    LIMIT 1;
  END IF;

  -- Assign to conversation if provided
  IF p_conversation_id IS NOT NULL AND v_connection_id IS NOT NULL THEN
    UPDATE whatsapp_conversations
    SET zapi_connection_id = v_connection_id
    WHERE id = p_conversation_id AND zapi_connection_id IS NULL;
  END IF;

  RETURN v_connection_id;
END;
$$;

-- Function to get zapi credentials by connection id
CREATE OR REPLACE FUNCTION public.get_zapi_credentials(p_connection_id uuid)
RETURNS TABLE(instance_id text, token text, security_token text, phone_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT instance_id, token, security_token, phone_number
  FROM zapi_connections
  WHERE id = p_connection_id AND is_active = true;
$$;
