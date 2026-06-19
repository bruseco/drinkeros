-- Marca como 'skipped' todos os logs NIBO cujo pedido não tem valor pago
UPDATE public.nibo_sync_log nsl
SET status = 'skipped',
    last_error = 'Pedido sem valor pago — não emite NF'
FROM (
  SELECT 'course:'||id::text AS oid, amount FROM public.user_courses
  UNION ALL SELECT 'ebook:'||id::text, amount FROM public.user_ebooks
  UNION ALL SELECT 'combo:'||id::text, amount FROM public.user_combos
  UNION ALL SELECT 'package:'||id::text, amount FROM public.user_packages
  UNION ALL SELECT 'vip:'||id::text, amount FROM public.vip_payments
) o
WHERE o.oid = nsl.order_id
  AND COALESCE(o.amount, 0) <= 0
  AND nsl.status IN ('partial','failed','pending');