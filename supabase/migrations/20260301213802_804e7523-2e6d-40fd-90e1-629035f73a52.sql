
-- Nova coluna
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN last_message_direction text DEFAULT 'inbound';

-- Backfill com a última mensagem de cada conversa
UPDATE public.whatsapp_conversations c
SET last_message_direction = sub.direction
FROM (
  SELECT DISTINCT ON (conversation_id) conversation_id, direction
  FROM public.whatsapp_messages
  ORDER BY conversation_id, created_at DESC
) sub
WHERE c.id = sub.conversation_id;

-- Trigger para manter atualizado
CREATE OR REPLACE FUNCTION public.update_conversation_last_direction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.whatsapp_conversations
  SET last_message_direction = NEW.direction
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_last_direction
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_direction();
