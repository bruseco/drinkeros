
-- Remove vinculações antigas em course_packages e remove o "package" RAND antigo
DELETE FROM public.course_packages WHERE package_id IN (SELECT id FROM public.packages WHERE slug = 'rand');
DELETE FROM public.packages WHERE slug = 'rand';

-- Cria o combo RAND (Pacote)
INSERT INTO public.combos (name, slug, description, price, is_active, is_available_for_sale, includes_exclusive_access, display_order)
VALUES (
  'RAND',
  'rand',
  'Curso Clássicos & Destilados + 1 ano do Clube dos Drinkeros.',
  147.00,
  true,
  true,
  true,
  0
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  is_active = true,
  is_available_for_sale = true,
  includes_exclusive_access = true;

-- Vincula curso Clássicos & Destilados ao combo RAND
INSERT INTO public.combo_courses (combo_id, course_id, display_order)
SELECT c.id, co.id, 0
FROM public.combos c
CROSS JOIN public.courses co
WHERE c.slug = 'rand' AND co.slug = 'classicos-destilados'
ON CONFLICT (combo_id, course_id) DO NOTHING;
