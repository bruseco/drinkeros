-- Remove table-wide SELECT (which implicitly exposes file_url) from public roles.
REVOKE SELECT ON public.ebooks FROM anon;
REVOKE SELECT ON public.ebooks FROM authenticated;

-- Re-assert column-level SELECT grants for non-sensitive columns only.
GRANT SELECT (id, name, slug, description, cover_image_url, price, is_active, display_order, created_at, updated_at, stripe_product_id, stripe_price_id)
  ON public.ebooks TO anon, authenticated;

-- Editors/admins keep write access (RLS still enforces can_edit).
GRANT INSERT, UPDATE, DELETE ON public.ebooks TO authenticated;
GRANT ALL ON public.ebooks TO service_role;