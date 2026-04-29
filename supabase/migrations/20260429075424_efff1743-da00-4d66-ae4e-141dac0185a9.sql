-- Ajuste: garantir que vendas Mercado Pago em vip_payments sejam SEMPRE detectadas
-- mesmo quando metadata.source não foi gravado (fallback via mercadopago_payment_id presente)
CREATE OR REPLACE FUNCTION public.admin_orders(
  p_search text DEFAULT NULL::text,
  p_source text DEFAULT NULL::text,
  p_product_type text DEFAULT NULL::text,
  p_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(id text, user_id uuid, buyer_name text, buyer_email text, buyer_phone text, product_type text, product_id uuid, product_name text, amount numeric, currency text, source text, purchased_at timestamp with time zone, external_ref text, total_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_term text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_term := nullif(trim(coalesce(p_search, '')), '');

  RETURN QUERY
  WITH vip_ranked AS (
    SELECT
      vp.*,
      row_number() OVER (
        PARTITION BY COALESCE(
          vp.stripe_invoice_id,
          vp.stripe_payment_intent_id,
          vp.metadata->>'mercadopago_payment_id',
          vp.metadata->>'session_id',
          vp.id::text
        )
        ORDER BY COALESCE(vp.paid_at, vp.created_at) ASC, vp.created_at ASC
      ) AS payment_rank
    FROM vip_payments vp
    WHERE vp.status = 'paid'
      AND NOT (
        vp.stripe_subscription_id IS NOT NULL
        AND vp.stripe_invoice_id IS NULL
        AND vp.metadata ? 'session_id'
        AND EXISTS (
          SELECT 1 FROM vip_payments invoice_row
          WHERE invoice_row.status = 'paid'
            AND invoice_row.stripe_invoice_id IS NOT NULL
            AND invoice_row.stripe_subscription_id = vp.stripe_subscription_id
            AND abs(extract(epoch FROM (COALESCE(invoice_row.paid_at, invoice_row.created_at) - COALESCE(vp.paid_at, vp.created_at)))) <= 86400
        )
      )
  ),
  base AS (
    SELECT
      'vip:' || vp.id::text AS id,
      vp.user_id,
      'clube'::text AS product_type,
      NULL::uuid AS product_id,
      'Clube dos Drinkeros'::text AS product_name,
      vp.amount,
      vp.currency,
      -- Fallback robusto: se tem mercadopago_payment_id ou source=mercadopago, é MP.
      -- Se tem qualquer ID stripe, é stripe. Senão, mantém stripe como default.
      CASE
        WHEN vp.metadata->>'source' = 'mercadopago' THEN 'mercadopago'
        WHEN vp.metadata ? 'mercadopago_payment_id' THEN 'mercadopago'
        WHEN vp.stripe_invoice_id IS NOT NULL OR vp.stripe_payment_intent_id IS NOT NULL OR vp.stripe_subscription_id IS NOT NULL THEN 'stripe'
        ELSE 'stripe'
      END AS source,
      COALESCE(vp.paid_at, vp.created_at) AS purchased_at,
      COALESCE(vp.stripe_invoice_id, vp.stripe_payment_intent_id, vp.metadata->>'mercadopago_payment_id', vp.metadata->>'session_id', vp.stripe_subscription_id) AS external_ref
    FROM vip_ranked vp
    WHERE vp.payment_rank = 1

    UNION ALL
    SELECT 'course:' || uc.id::text, uc.user_id, 'curso', uc.course_id,
           c.name, COALESCE(uc.amount, c.price), COALESCE(uc.currency, 'BRL'), uc.source, uc.purchased_at,
           COALESCE(uc.mercadopago_payment_id, uc.stripe_payment_intent_id, uc.stripe_session_id)
    FROM user_courses uc
    JOIN courses c ON c.id = uc.course_id
    WHERE uc.source IN ('stripe','mercadopago')
      AND NOT EXISTS (
        SELECT 1 FROM user_combos combo_access
        JOIN combo_courses cc ON cc.combo_id = combo_access.combo_id
        WHERE combo_access.user_id = uc.user_id
          AND cc.course_id = uc.course_id
          AND combo_access.source IN ('stripe','mercadopago')
          AND abs(extract(epoch FROM (combo_access.purchased_at - uc.purchased_at))) <= 300
      )

    UNION ALL
    SELECT 'ebook:' || ue.id::text, ue.user_id, 'ebook', ue.ebook_id,
           e.name, COALESCE(ue.amount, e.price), COALESCE(ue.currency, 'BRL'), ue.source, ue.purchased_at,
           COALESCE(ue.mercadopago_payment_id, ue.stripe_payment_intent_id, ue.stripe_session_id)
    FROM user_ebooks ue
    JOIN ebooks e ON e.id = ue.ebook_id
    WHERE ue.source IN ('stripe','mercadopago')
      AND NOT EXISTS (
        SELECT 1 FROM user_combos combo_access
        JOIN combo_ebooks ce ON ce.combo_id = combo_access.combo_id
        WHERE combo_access.user_id = ue.user_id
          AND ce.ebook_id = ue.ebook_id
          AND combo_access.source IN ('stripe','mercadopago')
          AND abs(extract(epoch FROM (combo_access.purchased_at - ue.purchased_at))) <= 300
      )

    UNION ALL
    SELECT 'combo:' || ucb.id::text, ucb.user_id, 'combo', ucb.combo_id,
           cb.name, COALESCE(ucb.amount, cb.price), COALESCE(ucb.currency, 'BRL'), ucb.source, ucb.purchased_at,
           COALESCE(ucb.mercadopago_payment_id, ucb.stripe_payment_intent_id, ucb.stripe_session_id)
    FROM user_combos ucb
    JOIN combos cb ON cb.id = ucb.combo_id
    WHERE ucb.source IN ('stripe','mercadopago')

    UNION ALL
    SELECT 'package:' || up.id::text, up.user_id, 'pacote', up.package_id,
           pk.name, COALESCE(up.amount, pk.price), COALESCE(up.currency, 'BRL'), up.source, up.purchased_at,
           COALESCE(up.mercadopago_payment_id, up.stripe_payment_intent_id, up.stripe_session_id)
    FROM user_packages up
    JOIN packages pk ON pk.id = up.package_id
    WHERE up.source IN ('stripe','mercadopago')
      AND NOT EXISTS (
        SELECT 1 FROM user_courses uc2
        JOIN course_packages cp ON cp.course_id = uc2.course_id
        WHERE uc2.user_id = up.user_id
          AND cp.package_id = up.package_id
          AND uc2.source IN ('stripe','mercadopago')
          AND abs(extract(epoch FROM (uc2.purchased_at - up.purchased_at))) <= 300
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_combos ucb2
        JOIN combo_courses cc ON cc.combo_id = ucb2.combo_id
        JOIN course_packages cp2 ON cp2.course_id = cc.course_id
        WHERE ucb2.user_id = up.user_id
          AND cp2.package_id = up.package_id
          AND ucb2.source IN ('stripe','mercadopago')
          AND abs(extract(epoch FROM (ucb2.purchased_at - up.purchased_at))) <= 300
      )
  ),
  enriched AS (
    SELECT b.*, pr.full_name AS buyer_name, pr.email AS buyer_email, pr.phone AS buyer_phone
    FROM base b
    LEFT JOIN profiles pr ON pr.user_id = b.user_id
  ),
  filtered AS (
    SELECT * FROM enriched e
    WHERE (p_source IS NULL OR e.source = p_source)
      AND (p_product_type IS NULL OR e.product_type = p_product_type)
      AND (p_from IS NULL OR e.purchased_at >= p_from)
      AND (p_to IS NULL OR e.purchased_at <= p_to)
      AND (
        v_term IS NULL OR
        e.buyer_email ILIKE '%' || v_term || '%' OR
        e.buyer_name ILIKE '%' || v_term || '%' OR
        e.buyer_phone ILIKE '%' || v_term || '%' OR
        e.product_name ILIKE '%' || v_term || '%' OR
        e.external_ref ILIKE '%' || v_term || '%'
      )
  ),
  cnt AS (SELECT count(*) AS total FROM filtered)
  SELECT f.id, f.user_id, f.buyer_name, f.buyer_email, f.buyer_phone,
    f.product_type, f.product_id, f.product_name, f.amount, f.currency,
    f.source, f.purchased_at, f.external_ref, cnt.total
  FROM filtered f, cnt
  ORDER BY f.purchased_at DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- Notificar PostgREST para recarregar o cache de schema
NOTIFY pgrst, 'reload schema';