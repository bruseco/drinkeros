
-- Add UNIQUE constraints only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_courses_user_id_course_id_key') THEN
    ALTER TABLE public.user_courses ADD CONSTRAINT user_courses_user_id_course_id_key UNIQUE (user_id, course_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_combos_user_id_combo_id_key') THEN
    ALTER TABLE public.user_combos ADD CONSTRAINT user_combos_user_id_combo_id_key UNIQUE (user_id, combo_id);
  END IF;
END$$;

-- Trigger 1: Module added to a Course
CREATE OR REPLACE FUNCTION public.propagate_course_package_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO user_packages (user_id, package_id)
  SELECT uc.user_id, NEW.package_id
  FROM user_courses uc
  WHERE uc.course_id = NEW.course_id
  ON CONFLICT (user_id, package_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propagate_course_package_access_trigger ON public.course_packages;
CREATE TRIGGER propagate_course_package_access_trigger
AFTER INSERT ON public.course_packages
FOR EACH ROW
EXECUTE FUNCTION public.propagate_course_package_access();

-- Trigger 2: Course added to a Combo
CREATE OR REPLACE FUNCTION public.propagate_combo_course_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO user_courses (user_id, course_id)
  SELECT ucb.user_id, NEW.course_id
  FROM user_combos ucb
  WHERE ucb.combo_id = NEW.combo_id
  ON CONFLICT (user_id, course_id) DO NOTHING;

  INSERT INTO user_packages (user_id, package_id)
  SELECT ucb.user_id, cp.package_id
  FROM user_combos ucb
  CROSS JOIN course_packages cp
  WHERE ucb.combo_id = NEW.combo_id
    AND cp.course_id = NEW.course_id
  ON CONFLICT (user_id, package_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propagate_combo_course_access_trigger ON public.combo_courses;
CREATE TRIGGER propagate_combo_course_access_trigger
AFTER INSERT ON public.combo_courses
FOR EACH ROW
EXECUTE FUNCTION public.propagate_combo_course_access();
