-- Reporting only: propagated module access is not an independent sale.
-- Preserve the current function, permissions and other report fixes.
DO $migration$
DECLARE
  definition text;
  old_clause text := $old$WHERE up.source IN ('stripe','mercadopago')$old$;
  new_clause text := $new$WHERE up.source IN ('stripe','mercadopago')
      AND COALESCE(NULLIF(up.mercadopago_payment_id, ''), NULLIF(up.stripe_payment_intent_id, ''), NULLIF(up.stripe_session_id, '')) IS NOT NULL$new$;
BEGIN
  SELECT pg_get_functiondef('public.admin_orders(text,text,text,timestamptz,timestamptz,integer,integer)'::regprocedure)
    INTO definition;
  IF position(new_clause IN definition) > 0 THEN RETURN; END IF;
  IF position(old_clause IN definition) = 0 THEN
    RAISE EXCEPTION 'admin_orders package branch changed; review before applying';
  END IF;
  EXECUTE replace(definition, old_clause, new_clause);
END;
$migration$;
