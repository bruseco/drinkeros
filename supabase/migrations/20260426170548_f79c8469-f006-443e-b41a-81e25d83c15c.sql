-- Função: ao ativar/atualizar VIP, garante acesso aos 2 cursos com validade igual ao plano
CREATE OR REPLACE FUNCTION public.grant_vip_bonus_courses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus_course_ids uuid[] := ARRAY[
    '5b2b0454-c9d5-498d-9ab1-d158356c2a3f'::uuid, -- Bebida Decifrada
    'e80663ec-3dd9-4ed3-9a4a-5975d1374803'::uuid  -- Workshop Além dos Clássicos
  ];
  v_course_id uuid;
  v_expiry timestamptz;
BEGIN
  IF NEW.plan <> 'vip' THEN
    RETURN NEW;
  END IF;

  -- Lifetime: sem expiração
  IF EXISTS (SELECT 1 FROM user_lifetime_access WHERE user_id = NEW.user_id) THEN
    v_expiry := NULL;
  ELSE
    v_expiry := COALESCE(NEW.expires_at, NEW.activated_at + interval '1 year', now() + interval '1 year');
  END IF;

  FOREACH v_course_id IN ARRAY v_bonus_course_ids LOOP
    INSERT INTO public.user_courses (user_id, course_id, purchased_at, expires_at, source)
    VALUES (NEW.user_id, v_course_id, COALESCE(NEW.activated_at, now()), v_expiry, 'vip_bonus')
    ON CONFLICT (user_id, course_id) DO UPDATE
      SET expires_at = CASE
        WHEN v_expiry IS NULL THEN NULL
        WHEN user_courses.expires_at IS NULL THEN user_courses.expires_at
        WHEN user_courses.expires_at < v_expiry THEN v_expiry
        ELSE user_courses.expires_at
      END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_vip_bonus_courses ON public.user_plans;
CREATE TRIGGER trg_grant_vip_bonus_courses
AFTER INSERT OR UPDATE OF plan, expires_at ON public.user_plans
FOR EACH ROW
EXECUTE FUNCTION public.grant_vip_bonus_courses();

-- Backfill: aplica para todos os VIPs atuais
INSERT INTO public.user_courses (user_id, course_id, purchased_at, expires_at, source)
SELECT
  up.user_id,
  c.course_id,
  COALESCE(up.activated_at, now()),
  CASE
    WHEN EXISTS (SELECT 1 FROM user_lifetime_access la WHERE la.user_id = up.user_id) THEN NULL
    ELSE COALESCE(up.expires_at, up.activated_at + interval '1 year', now() + interval '1 year')
  END
  , 'vip_bonus'
FROM public.user_plans up
CROSS JOIN (VALUES
  ('5b2b0454-c9d5-498d-9ab1-d158356c2a3f'::uuid),
  ('e80663ec-3dd9-4ed3-9a4a-5975d1374803'::uuid)
) AS c(course_id)
WHERE up.plan = 'vip'
  AND (up.expires_at IS NULL OR up.expires_at > now())
ON CONFLICT (user_id, course_id) DO NOTHING;