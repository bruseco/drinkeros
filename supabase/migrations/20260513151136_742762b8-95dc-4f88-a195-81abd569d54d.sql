
-- Tabela de log/sincronização das vendas com o NIBO
CREATE TABLE IF NOT EXISTS public.nibo_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE, -- formato 'vip:uuid' | 'course:uuid' | 'ebook:uuid' | 'combo:uuid' | 'package:uuid'
  user_id uuid,
  buyer_email text,
  buyer_name text,
  amount numeric(10,2),
  currency text DEFAULT 'BRL',
  product_type text,
  product_name text,
  status text NOT NULL DEFAULT 'pending', -- pending | success | partial | failed
  customer_status text, -- success | failed | skipped
  schedule_status text,
  invoice_status text,
  nibo_customer_id text,
  nibo_schedule_id text,
  nibo_invoice_id text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_nibo_sync_log_status ON public.nibo_sync_log (status);
CREATE INDEX IF NOT EXISTS idx_nibo_sync_log_user_id ON public.nibo_sync_log (user_id);
CREATE INDEX IF NOT EXISTS idx_nibo_sync_log_created_at ON public.nibo_sync_log (created_at DESC);

ALTER TABLE public.nibo_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage nibo_sync_log"
  ON public.nibo_sync_log
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_nibo_sync_log_updated_at
  BEFORE UPDATE ON public.nibo_sync_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
