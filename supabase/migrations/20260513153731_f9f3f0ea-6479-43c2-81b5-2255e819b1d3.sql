CREATE OR REPLACE FUNCTION public.nibo_get_order(p_order_id text)
RETURNS TABLE(
  id text, user_id uuid, buyer_name text, buyer_email text, buyer_phone text,
  product_type text, product_id uuid, product_name text, amount numeric, currency text,
  source text, purchased_at timestamp with time zone, external_ref text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix text := split_part(p_order_id, ':', 1);
  v_uuid uuid := nullif(split_part(p_order_id, ':', 2), '')::uuid;
BEGIN
  IF v_uuid IS NULL THEN RETURN; END IF;

  IF v_prefix = 'vip' THEN
    RETURN QUERY
    SELECT 'vip:'||vp.id::text, vp.user_id, pr.full_name, pr.email, pr.phone,
           'clube'::text, NULL::uuid, 'Clube dos Drinkeros'::text,
           vp.amount, vp.currency,
           CASE WHEN vp.metadata->>'source' = 'mercadopago' OR vp.metadata ? 'mercadopago_payment_id' THEN 'mercadopago' ELSE 'stripe' END,
           COALESCE(vp.paid_at, vp.created_at),
           COALESCE(vp.stripe_invoice_id, vp.stripe_payment_intent_id, vp.metadata->>'mercadopago_payment_id', vp.metadata->>'session_id', vp.stripe_subscription_id)
    FROM vip_payments vp LEFT JOIN profiles pr ON pr.user_id = vp.user_id
    WHERE vp.id = v_uuid;
  ELSIF v_prefix = 'course' THEN
    RETURN QUERY
    SELECT 'course:'||uc.id::text, uc.user_id, pr.full_name, pr.email, pr.phone,
           'curso'::text, uc.course_id, c.name, uc.amount, COALESCE(uc.currency,'BRL'),
           uc.source, uc.purchased_at,
           COALESCE(uc.mercadopago_payment_id, uc.stripe_payment_intent_id, uc.stripe_session_id)
    FROM user_courses uc JOIN courses c ON c.id=uc.course_id LEFT JOIN profiles pr ON pr.user_id=uc.user_id
    WHERE uc.id = v_uuid;
  ELSIF v_prefix = 'ebook' THEN
    RETURN QUERY
    SELECT 'ebook:'||ue.id::text, ue.user_id, pr.full_name, pr.email, pr.phone,
           'ebook'::text, ue.ebook_id, e.name, ue.amount, COALESCE(ue.currency,'BRL'),
           ue.source, ue.purchased_at,
           COALESCE(ue.mercadopago_payment_id, ue.stripe_payment_intent_id, ue.stripe_session_id)
    FROM user_ebooks ue JOIN ebooks e ON e.id=ue.ebook_id LEFT JOIN profiles pr ON pr.user_id=ue.user_id
    WHERE ue.id = v_uuid;
  ELSIF v_prefix = 'combo' THEN
    RETURN QUERY
    SELECT 'combo:'||ucb.id::text, ucb.user_id, pr.full_name, pr.email, pr.phone,
           'combo'::text, ucb.combo_id, cb.name, ucb.amount, COALESCE(ucb.currency,'BRL'),
           ucb.source, ucb.purchased_at,
           COALESCE(ucb.mercadopago_payment_id, ucb.stripe_payment_intent_id, ucb.stripe_session_id)
    FROM user_combos ucb JOIN combos cb ON cb.id=ucb.combo_id LEFT JOIN profiles pr ON pr.user_id=ucb.user_id
    WHERE ucb.id = v_uuid;
  ELSIF v_prefix = 'package' THEN
    RETURN QUERY
    SELECT 'package:'||up.id::text, up.user_id, pr.full_name, pr.email, pr.phone,
           'pacote'::text, up.package_id, pk.name, up.amount, COALESCE(up.currency,'BRL'),
           up.source, up.purchased_at,
           COALESCE(up.mercadopago_payment_id, up.stripe_payment_intent_id, up.stripe_session_id)
    FROM user_packages up JOIN packages pk ON pk.id=up.package_id LEFT JOIN profiles pr ON pr.user_id=up.user_id
    WHERE up.id = v_uuid;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.nibo_get_order(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nibo_get_order(text) TO service_role;