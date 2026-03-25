
-- Add connection status columns to zapi_connections
ALTER TABLE public.zapi_connections
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_disconnect_reason text;

-- Update select_zapi_connection to filter by connection_status
CREATE OR REPLACE FUNCTION public.select_zapi_connection(p_conversation_id uuid DEFAULT NULL::uuid, p_is_new_contact boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_connection_id uuid;
  v_existing_connection_id uuid;
BEGIN
  IF p_conversation_id IS NOT NULL THEN
    SELECT zapi_connection_id INTO v_existing_connection_id
    FROM whatsapp_conversations
    WHERE id = p_conversation_id;
    
    IF v_existing_connection_id IS NOT NULL THEN
      -- Verify the existing connection is still usable
      IF EXISTS (
        SELECT 1 FROM zapi_connections
        WHERE id = v_existing_connection_id
          AND is_active = true
          AND connection_status != 'disconnected'
      ) THEN
        RETURN v_existing_connection_id;
      END IF;
    END IF;
  END IF;

  UPDATE zapi_connections
  SET new_contacts_today = 0, last_reset_at = CURRENT_DATE
  WHERE last_reset_at < CURRENT_DATE;

  IF p_is_new_contact THEN
    SELECT id INTO v_connection_id
    FROM zapi_connections
    WHERE is_active = true
      AND connection_status != 'disconnected'
      AND new_contacts_today < daily_new_contact_limit
    ORDER BY new_contacts_today ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_connection_id IS NULL THEN
      RAISE EXCEPTION 'DAILY_LIMIT_REACHED: All connections have reached their daily new contact limit';
    END IF;

    UPDATE zapi_connections
    SET new_contacts_today = new_contacts_today + 1
    WHERE id = v_connection_id;
  ELSE
    SELECT id INTO v_connection_id
    FROM zapi_connections
    WHERE is_active = true
      AND connection_status != 'disconnected'
    ORDER BY new_contacts_today ASC, created_at ASC
    LIMIT 1;
  END IF;

  IF p_conversation_id IS NOT NULL AND v_connection_id IS NOT NULL THEN
    UPDATE whatsapp_conversations
    SET zapi_connection_id = v_connection_id
    WHERE id = p_conversation_id AND zapi_connection_id IS NULL;
  END IF;

  RETURN v_connection_id;
END;
$function$;
