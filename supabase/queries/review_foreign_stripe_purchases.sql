-- READ ONLY. Missing app metadata is a review signal, not proof of a foreign sale.
-- Strict list requested: no user AND no purchase email AND no Drinkeros marker.
SELECT id, created_at, transaction_id, product_type, product_name,
       amount_paid, currency, user_id, buyer_email, metadata, meta_capi_sent_at
FROM public.purchases
WHERE gateway = 'stripe'
  AND user_id IS NULL
  AND NULLIF(BTRIM(buyer_email), '') IS NULL
  AND metadata->>'app' IS DISTINCT FROM 'drinkeros'
ORDER BY created_at DESC;

-- Additional review list: also catches client_reference_id values saved as
-- user_id without a corresponding profile/email (the three reported examples).
SELECT p.id, p.created_at, p.transaction_id, p.product_type, p.product_name,
       p.amount_paid, p.currency, p.user_id, p.buyer_email, p.metadata,
       p.meta_capi_sent_at,
       CASE WHEN p.user_id IS NULL THEN 'missing_user'
            ELSE 'user_reference_without_profile_email' END AS review_reason
FROM public.purchases p
WHERE p.gateway = 'stripe'
  AND NULLIF(BTRIM(p.buyer_email), '') IS NULL
  AND p.metadata->>'app' IS DISTINCT FROM 'drinkeros'
  AND (p.user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = p.user_id AND NULLIF(BTRIM(pr.email), '') IS NOT NULL
  ))
ORDER BY p.created_at DESC;
