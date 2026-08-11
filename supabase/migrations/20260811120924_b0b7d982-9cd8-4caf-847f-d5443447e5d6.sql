CREATE OR REPLACE FUNCTION public.get_page_funnel_sales(
  _product_type text,
  _product_slug text,
  _since timestamptz DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_id uuid;
  v_count bigint;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _product_type = 'combo' THEN
    SELECT id INTO v_product_id FROM public.combos WHERE slug = _product_slug;
  ELSIF _product_type = 'course' THEN
    SELECT id INTO v_product_id FROM public.courses WHERE slug = _product_slug;
  ELSIF _product_type = 'ebook' THEN
    SELECT id INTO v_product_id FROM public.ebooks WHERE slug = _product_slug;
  ELSIF _product_type = 'package' THEN
    SELECT id INTO v_product_id FROM public.packages WHERE slug = _product_slug;
  ELSE
    RETURN 0;
  END IF;

  IF v_product_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.purchases
  WHERE product_id = v_product_id
    AND product_type = _product_type
    AND status = 'approved'
    AND (_since IS NULL OR created_at >= _since);

  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_page_funnel_sales(text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_page_funnel_sales(text, text, timestamptz) TO authenticated;
