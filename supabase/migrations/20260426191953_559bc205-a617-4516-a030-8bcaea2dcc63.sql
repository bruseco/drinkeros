CREATE OR REPLACE FUNCTION public.admin_orders(
  p_search text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_product_type text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id text,
  user_id uuid,
  buyer_name text,
  buyer_email text,
  buyer_phone text,
  product_type text,
  product_id uuid,
  product_name text,
  amount numeric,
  currency text,
  source text,
  purchased_at timestamptz,
  external_ref text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_term := nullif(trim(coalesce(p_search, '')), '');

  RETURN QUERY
  WITH base AS (
    -- VIP / Clube dos Drinkeros (Stripe)
    SELECT
      'vip:' || vp.id::text AS id,
      vp.user_id,
      'clube'::text AS product_type,
      NULL::uuid AS product_id,
      'Clube dos Drinkeros'::text AS product_name,
      vp.amount,
      vp.currency,
      'stripe'::text AS source,
      COALESCE(vp.paid_at, vp.created_at) AS purchased_at,
      COALESCE(vp.stripe_invoice_id, vp.stripe_payment_intent_id, vp.stripe_subscription_id) AS external_ref
    FROM vip_payments vp
    WHERE vp.status = 'paid'

    UNION ALL
    SELECT 'course:' || uc.id::text, uc.user_id, 'curso', uc.course_id,
           c.name, c.price, 'BRL', uc.source, uc.purchased_at, NULL
    FROM user_courses uc
    JOIN courses c ON c.id = uc.course_id
    WHERE uc.source IN ('stripe','woocommerce','hotmart','pix')

    UNION ALL
    SELECT 'ebook:' || ue.id::text, ue.user_id, 'ebook', ue.ebook_id,
           e.name, e.price, 'BRL', ue.source, ue.purchased_at, NULL
    FROM user_ebooks ue
    JOIN ebooks e ON e.id = ue.ebook_id
    WHERE ue.source IN ('stripe','woocommerce','hotmart','pix')

    UNION ALL
    SELECT 'combo:' || ucb.id::text, ucb.user_id, 'combo', ucb.combo_id,
           cb.name, cb.price, 'BRL', ucb.source, ucb.purchased_at, NULL
    FROM user_combos ucb
    JOIN combos cb ON cb.id = ucb.combo_id
    WHERE ucb.source IN ('stripe','woocommerce','hotmart','pix')

    UNION ALL
    SELECT 'package:' || up.id::text, up.user_id, 'pacote', up.package_id,
           pk.name, pk.price, 'BRL', up.source, up.purchased_at, NULL
    FROM user_packages up
    JOIN packages pk ON pk.id = up.package_id
    WHERE up.source IN ('stripe','woocommerce','hotmart','pix')
  ),
  enriched AS (
    SELECT b.*,
      pr.full_name AS buyer_name,
      pr.email     AS buyer_email,
      pr.phone     AS buyer_phone
    FROM base b
    LEFT JOIN profiles pr ON pr.user_id = b.user_id
  ),
  filtered AS (
    SELECT * FROM enriched e
    WHERE (p_source IS NULL OR e.source = p_source)
      AND (p_product_type IS NULL OR e.product_type = p_product_type)
      AND (p_from IS NULL OR e.purchased_at >= p_from)
      AND (p_to   IS NULL OR e.purchased_at <= p_to)
      AND (
        v_term IS NULL OR
        e.buyer_email ILIKE '%' || v_term || '%' OR
        e.buyer_name  ILIKE '%' || v_term || '%' OR
        e.buyer_phone ILIKE '%' || v_term || '%' OR
        e.product_name ILIKE '%' || v_term || '%' OR
        e.external_ref ILIKE '%' || v_term || '%'
      )
  ),
  cnt AS (SELECT count(*) AS total FROM filtered)
  SELECT
    f.id, f.user_id, f.buyer_name, f.buyer_email, f.buyer_phone,
    f.product_type, f.product_id, f.product_name, f.amount, f.currency,
    f.source, f.purchased_at, f.external_ref,
    cnt.total
  FROM filtered f, cnt
  ORDER BY f.purchased_at DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;