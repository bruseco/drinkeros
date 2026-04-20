-- 1. Propagação de combo->courses/packages: herdar datas do combo
CREATE OR REPLACE FUNCTION public.propagate_user_combo_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO user_courses (user_id, course_id, purchased_at, expires_at, source)
  SELECT NEW.user_id, cc.course_id, NEW.purchased_at, NEW.expires_at, NEW.source
  FROM combo_courses cc
  WHERE cc.combo_id = NEW.combo_id
  ON CONFLICT (user_id, course_id) DO NOTHING;

  INSERT INTO user_packages (user_id, package_id, purchased_at, expires_at, source)
  SELECT NEW.user_id, cp.package_id, NEW.purchased_at, NEW.expires_at, NEW.source
  FROM combo_courses cc
  JOIN course_packages cp ON cp.course_id = cc.course_id
  WHERE cc.combo_id = NEW.combo_id
  ON CONFLICT (user_id, package_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2. Propagação de combo->ebooks: herdar datas
CREATE OR REPLACE FUNCTION public.propagate_user_combo_ebook_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_ebooks (user_id, ebook_id, purchased_at, expires_at, source)
  SELECT NEW.user_id, ce.ebook_id, NEW.purchased_at, NEW.expires_at, NEW.source
  FROM public.combo_ebooks ce
  WHERE ce.combo_id = NEW.combo_id
  ON CONFLICT (user_id, ebook_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 3. Propagação course->packages: herdar
CREATE OR REPLACE FUNCTION public.propagate_user_course_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO user_packages (user_id, package_id, purchased_at, expires_at, source)
  SELECT NEW.user_id, cp.package_id, NEW.purchased_at, NEW.expires_at, NEW.source
  FROM course_packages cp
  WHERE cp.course_id = NEW.course_id
  ON CONFLICT (user_id, package_id) DO NOTHING;
  RETURN NEW;
END;
$function$;