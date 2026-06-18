
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_neighborhood text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text;

-- Claim atômico de pedido NIBO. Retorna true se o caller pode prosseguir (única invocação concorrente).
CREATE OR REPLACE FUNCTION public.nibo_claim_order(
  p_order_id text,
  p_user_id uuid,
  p_buyer_email text,
  p_buyer_name text,
  p_amount numeric,
  p_currency text,
  p_product_type text,
  p_product_name text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing record;
BEGIN
  -- Trava a linha (ou cria) atomicamente
  SELECT id, status, last_attempt_at INTO v_existing
  FROM public.nibo_sync_log
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF FOUND THEN
    -- Já concluído com sucesso → não reprocessa
    IF v_existing.status = 'success' THEN
      RETURN false;
    END IF;
    -- Outra execução em andamento há menos de 5 min → cede a vez
    IF v_existing.status = 'processing'
       AND v_existing.last_attempt_at IS NOT NULL
       AND v_existing.last_attempt_at > now() - interval '5 minutes' THEN
      RETURN false;
    END IF;
    UPDATE public.nibo_sync_log
       SET status = 'processing',
           attempts = COALESCE(attempts, 0) + 1,
           last_attempt_at = now(),
           updated_at = now(),
           buyer_email = COALESCE(p_buyer_email, buyer_email),
           buyer_name = COALESCE(p_buyer_name, buyer_name),
           amount = COALESCE(p_amount, amount),
           currency = COALESCE(p_currency, currency),
           product_type = COALESCE(p_product_type, product_type),
           product_name = COALESCE(p_product_name, product_name),
           user_id = COALESCE(p_user_id, user_id)
     WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.nibo_sync_log
      (order_id, user_id, buyer_email, buyer_name, amount, currency, product_type, product_name, status, attempts, last_attempt_at)
    VALUES
      (p_order_id, p_user_id, p_buyer_email, p_buyer_name, p_amount, p_currency, p_product_type, p_product_name, 'processing', 1, now());
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.nibo_claim_order(text, uuid, text, text, numeric, text, text, text) TO service_role;
