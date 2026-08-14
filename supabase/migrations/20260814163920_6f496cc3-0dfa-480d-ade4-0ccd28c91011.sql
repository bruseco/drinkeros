CREATE OR REPLACE FUNCTION public.get_page_funnel_sales_range(
  _product_type text,
  _product_slug text,
  _since timestamptz DEFAULT NULL,
  _min_amount numeric DEFAULT NULL,
  _max_amount numeric DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_product_name text;
  v_count bigint;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_partner(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _product_type = 'combo' THEN
    SELECT id, name INTO v_product_id, v_product_name FROM public.combos WHERE slug = _product_slug;
  ELSIF _product_type = 'course' THEN
    SELECT id, title INTO v_product_id, v_product_name FROM public.courses WHERE slug = _product_slug;
  ELSIF _product_type = 'ebook' THEN
    SELECT id, title INTO v_product_id, v_product_name FROM public.ebooks WHERE slug = _product_slug;
  ELSIF _product_type = 'package' THEN
    SELECT id, title INTO v_product_id, v_product_name FROM public.packages WHERE slug = _product_slug;
  ELSE
    RETURN 0;
  END IF;

  IF v_product_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.purchases
  WHERE status = 'approved'
    AND product_type = _product_type
    AND (
      product_id = v_product_id::text
      OR (product_id IS NULL AND v_product_name IS NOT NULL AND lower(product_name) = lower(v_product_name))
    )
    AND (_since IS NULL OR created_at >= _since)
    AND (_min_amount IS NULL OR amount_paid >= _min_amount)
    AND (_max_amount IS NULL OR amount_paid <= _max_amount);

  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_page_funnel_sales_range(text, text, timestamptz, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_page_funnel_sales_range(text, text, timestamptz, numeric, numeric) TO authenticated;