
-- Tabela 1: Cache de scraping
CREATE TABLE public.upsell_sales_page_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type text NOT NULL,
  product_id uuid NOT NULL,
  checkout_url text,
  scraped_content text,
  scraped_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_type, product_id)
);
ALTER TABLE public.upsell_sales_page_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage cache" ON public.upsell_sales_page_cache
  FOR ALL USING (is_admin(auth.uid()));

-- Tabela 2: Log de emails individuais
CREATE TABLE public.upsell_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.upsell_sequences(id) ON DELETE CASCADE,
  step integer NOT NULL,
  subject text,
  body_html text,
  sent_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'sent'
);
ALTER TABLE public.upsell_email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage email logs" ON public.upsell_email_logs
  FOR ALL USING (is_admin(auth.uid()));

-- Tabela 3: Descadastramento
CREATE TABLE public.upsell_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  unsubscribed_at timestamptz DEFAULT now()
);
ALTER TABLE public.upsell_unsubscribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view unsubscribes" ON public.upsell_unsubscribes
  FOR SELECT USING (is_admin(auth.uid()));

-- Trigger para updated_at no cache
CREATE TRIGGER update_upsell_sales_page_cache_updated_at
  BEFORE UPDATE ON public.upsell_sales_page_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
