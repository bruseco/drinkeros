UPDATE public.purchases
SET status = 'refunded',
    updated_at = now(),
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('refunded_manually', true, 'refund_source', 'mercadopago_dashboard', 'refunded_at', now())
WHERE gateway = 'mercado_pago' AND transaction_id = '174863299491';

UPDATE public.user_plans
SET plan = 'free', expires_at = null, source = 'refund', updated_at = now()
WHERE user_id = 'e53c30bb-e7aa-41e0-a832-9468ef02a786';

DELETE FROM public.user_courses
WHERE user_id = 'e53c30bb-e7aa-41e0-a832-9468ef02a786' AND source = 'vip_bonus';

UPDATE public.user_exclusive_access
SET expires_at = now()
WHERE user_id = 'e53c30bb-e7aa-41e0-a832-9468ef02a786';