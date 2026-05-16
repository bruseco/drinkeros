
CREATE TABLE public.clube_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  full_price numeric NOT NULL DEFAULT 197,
  promo_price numeric NOT NULL DEFAULT 69,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clube_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clube_settings public read"
  ON public.clube_settings FOR SELECT
  USING (true);

CREATE POLICY "clube_settings admin write"
  ON public.clube_settings FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'editor'));

CREATE TRIGGER update_clube_settings_updated_at
  BEFORE UPDATE ON public.clube_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.clube_settings (singleton, full_price, promo_price, benefits)
VALUES (
  true,
  197,
  69,
  '[
    {"text": "<strong>Veja quantos Drinks você quiser.</strong>"},
    {"text": "<strong>Xaropes Artesanais</strong> liberados"},
    {"text": "Acesso a minissérie <strong>Bebida Decifrada</strong>"},
    {"text": "Acesso ao <strong>Workshop Além dos Clássicos</strong> (com certificado)"},
    {"text": "Participa da <strong>Batalha dos Drinkeros</strong>"},
    {"text": "Sócios ganham <strong>80% de desconto</strong> na compra de qualquer produto."}
  ]'::jsonb
);
