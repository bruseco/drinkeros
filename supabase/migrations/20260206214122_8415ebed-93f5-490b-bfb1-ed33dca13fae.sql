
-- Passo 1: Adicionar coluna phone na tabela profiles
ALTER TABLE public.profiles ADD COLUMN phone text;

-- Passo 2: Adicionar coluna woocommerce_product_id na tabela packages
ALTER TABLE public.packages ADD COLUMN woocommerce_product_id text;
