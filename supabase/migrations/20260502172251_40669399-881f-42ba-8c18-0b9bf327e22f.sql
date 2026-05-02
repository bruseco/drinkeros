-- Cria pacote RAND com Clássicos & Destilados (Clube de 1 ano será concedido via lógica de pós-compra)
INSERT INTO public.packages (name, slug, description, price, is_active, is_available_for_sale, display_order)
VALUES (
  'RAND',
  'rand',
  'Pacote RAND: Curso Clássicos & Destilados + 1 ano de Clube dos Drinkeros',
  147.00,
  true,
  true,
  0
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  is_active = true,
  is_available_for_sale = true;

-- Vincula o curso Clássicos & Destilados ao pacote RAND
INSERT INTO public.course_packages (package_id, course_id, display_order)
SELECT p.id, c.id, 0
FROM public.packages p
CROSS JOIN public.courses c
WHERE p.slug = 'rand' AND c.slug = 'classicos-destilados'
ON CONFLICT DO NOTHING;