-- Remove duplicidades já conhecidas em pagamentos do Clube
WITH mp_dupes AS (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY metadata->>'mercadopago_payment_id'
             ORDER BY COALESCE(paid_at, created_at) ASC, created_at ASC
           ) AS rn
    FROM public.vip_payments
    WHERE status = 'paid'
      AND metadata->>'source' = 'mercadopago'
      AND metadata->>'mercadopago_payment_id' IS NOT NULL
  ) x
  WHERE rn > 1
), stripe_checkout_dupes AS (
  SELECT checkout_row.id
  FROM public.vip_payments checkout_row
  WHERE checkout_row.status = 'paid'
    AND checkout_row.stripe_subscription_id IS NOT NULL
    AND checkout_row.stripe_invoice_id IS NULL
    AND checkout_row.metadata ? 'session_id'
    AND EXISTS (
      SELECT 1
      FROM public.vip_payments invoice_row
      WHERE invoice_row.status = 'paid'
        AND invoice_row.stripe_invoice_id IS NOT NULL
        AND invoice_row.stripe_subscription_id = checkout_row.stripe_subscription_id
        AND abs(extract(epoch FROM (COALESCE(invoice_row.paid_at, invoice_row.created_at) - COALESCE(checkout_row.paid_at, checkout_row.created_at)))) <= 86400
    )
), to_delete AS (
  SELECT id FROM mp_dupes
  UNION
  SELECT id FROM stripe_checkout_dupes
)
DELETE FROM public.vip_payments
WHERE id IN (SELECT id FROM to_delete);

-- Proteções de idempotência para pagamentos do Clube
CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_payments_unique_stripe_invoice
ON public.vip_payments (stripe_invoice_id)
WHERE stripe_invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_payments_unique_stripe_payment_intent
ON public.vip_payments (stripe_payment_intent_id)
WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_payments_unique_stripe_session
ON public.vip_payments ((metadata->>'session_id'))
WHERE metadata->>'session_id' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_payments_unique_mercadopago_payment
ON public.vip_payments ((metadata->>'mercadopago_payment_id'))
WHERE metadata->>'source' = 'mercadopago'
  AND metadata->>'mercadopago_payment_id' IS NOT NULL;

-- Relatório de vendas: apenas compras reais confirmadas, sem itens propagados
CREATE OR REPLACE FUNCTION public.admin_orders(
  p_search text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_product_type text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id text, user_id uuid, buyer_name text, buyer_email text, buyer_phone text,
  product_type text, product_id uuid, product_name text, amount numeric, currency text,
  source text, purchased_at timestamptz, external_ref text, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
          SELECT 1
          FROM vip_payments invoice_row
          WHERE invoice_row.status = 'paid'
            AND invoice_row.stripe_invoice_id IS NOT NULL
            AND invoice_row.stripe_subscription_id = vp.stripe_subscription_id
            AND abs(extract(epoch FROM (COALESCE(invoice_row.paid_at, invoice_row.created_at) - COALESCE(vp.paid_at, vp.created_at)))) <= 86400
        )
      )
  ),
  base AS (
    -- Clube: cobrança confirmada, sem duplicar checkout + invoice da mesma assinatura
    SELECT
      'vip:' || vp.id::text AS id,
      vp.user_id,
      'clube'::text AS product_type,
      NULL::uuid AS product_id,
      'Clube dos Drinkeros'::text AS product_name,
      vp.amount,
      vp.currency,
      CASE WHEN vp.metadata->>'source' = 'mercadopago' THEN 'mercadopago' ELSE 'stripe' END AS source,
      COALESCE(vp.paid_at, vp.created_at) AS purchased_at,
      COALESCE(vp.stripe_invoice_id, vp.stripe_payment_intent_id, vp.metadata->>'mercadopago_payment_id', vp.metadata->>'session_id', vp.stripe_subscription_id) AS external_ref
    FROM vip_ranked vp
    WHERE vp.payment_rank = 1

    UNION ALL
    -- Curso avulso: exclui curso liberado automaticamente por combo comprado no mesmo momento
    SELECT 'course:' || uc.id::text, uc.user_id, 'curso', uc.course_id,
           c.name, c.price, 'BRL', uc.source, uc.purchased_at, uc.mercadopago_payment_id
    FROM user_courses uc
    JOIN courses c ON c.id = uc.course_id
    WHERE uc.source IN ('stripe','mercadopago')
      AND NOT EXISTS (
        SELECT 1
        FROM user_combos combo_access
        JOIN combo_courses cc ON cc.combo_id = combo_access.combo_id
        WHERE combo_access.user_id = uc.user_id
          AND cc.course_id = uc.course_id
          AND combo_access.source IN ('stripe','mercadopago')
          AND abs(extract(epoch FROM (combo_access.purchased_at - uc.purchased_at))) <= 300
      )

    UNION ALL
    -- E-book avulso: exclui e-book liberado automaticamente por combo comprado no mesmo momento
    SELECT 'ebook:' || ue.id::text, ue.user_id, 'ebook', ue.ebook_id,
           e.name, e.price, 'BRL', ue.source, ue.purchased_at, ue.mercadopago_payment_id
    FROM user_ebooks ue
    JOIN ebooks e ON e.id = ue.ebook_id
    WHERE ue.source IN ('stripe','mercadopago')
      AND NOT EXISTS (
        SELECT 1
        FROM user_combos combo_access
        JOIN combo_ebooks ce ON ce.combo_id = combo_access.combo_id
        WHERE combo_access.user_id = ue.user_id
          AND ce.ebook_id = ue.ebook_id
          AND combo_access.source IN ('stripe','mercadopago')
          AND abs(extract(epoch FROM (combo_access.purchased_at - ue.purchased_at))) <= 300
      )

    UNION ALL
    SELECT 'combo:' || ucb.id::text, ucb.user_id, 'combo', ucb.combo_id,
           cb.name, cb.price, 'BRL', ucb.source, ucb.purchased_at, ucb.mercadopago_payment_id
    FROM user_combos ucb
    JOIN combos cb ON cb.id = ucb.combo_id
    WHERE ucb.source IN ('stripe','mercadopago')

    UNION ALL
    -- Pacote avulso: exclui pacote liberado automaticamente por curso ou combo comprado no mesmo momento
    SELECT 'package:' || up.id::text, up.user_id, 'pacote', up.package_id,
           pk.name, pk.price, 'BRL', up.source, up.purchased_at, up.mercadopago_payment_id
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
    SELECT b.*,
      pr.full_name AS buyer_name, pr.email AS buyer_email, pr.phone AS buyer_phone
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