
-- 1. Trigger: user_courses INSERT -> propagar para user_packages
CREATE OR REPLACE FUNCTION public.propagate_user_course_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO user_packages (user_id, package_id)
  SELECT NEW.user_id, cp.package_id
  FROM course_packages cp
  WHERE cp.course_id = NEW.course_id
  ON CONFLICT (user_id, package_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_propagate_user_course_access
  AFTER INSERT ON user_courses
  FOR EACH ROW
  EXECUTE FUNCTION propagate_user_course_access();

-- 2. Trigger: user_combos INSERT -> propagar para user_courses e user_packages
CREATE OR REPLACE FUNCTION public.propagate_user_combo_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO user_courses (user_id, course_id)
  SELECT NEW.user_id, cc.course_id
  FROM combo_courses cc
  WHERE cc.combo_id = NEW.combo_id
  ON CONFLICT (user_id, course_id) DO NOTHING;

  INSERT INTO user_packages (user_id, package_id)
  SELECT NEW.user_id, cp.package_id
  FROM combo_courses cc
  JOIN course_packages cp ON cp.course_id = cc.course_id
  WHERE cc.combo_id = NEW.combo_id
  ON CONFLICT (user_id, package_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_propagate_user_combo_access
  AFTER INSERT ON user_combos
  FOR EACH ROW
  EXECUTE FUNCTION propagate_user_combo_access();

-- 3. Reconectar triggers existentes
CREATE TRIGGER trg_propagate_course_package_access
  AFTER INSERT ON course_packages
  FOR EACH ROW
  EXECUTE FUNCTION propagate_course_package_access();

CREATE TRIGGER trg_propagate_combo_course_access
  AFTER INSERT ON combo_courses
  FOR EACH ROW
  EXECUTE FUNCTION propagate_combo_course_access();

-- 4. Backfill: user_courses -> user_packages
INSERT INTO user_packages (user_id, package_id)
SELECT uc.user_id, cp.package_id
FROM user_courses uc
JOIN course_packages cp ON cp.course_id = uc.course_id
ON CONFLICT (user_id, package_id) DO NOTHING;

-- 5. Backfill: user_combos -> user_courses + user_packages
INSERT INTO user_courses (user_id, course_id)
SELECT ucb.user_id, cc.course_id
FROM user_combos ucb
JOIN combo_courses cc ON cc.combo_id = ucb.combo_id
ON CONFLICT (user_id, course_id) DO NOTHING;

INSERT INTO user_packages (user_id, package_id)
SELECT ucb.user_id, cp.package_id
FROM user_combos ucb
JOIN combo_courses cc ON cc.combo_id = ucb.combo_id
JOIN course_packages cp ON cp.course_id = cc.course_id
ON CONFLICT (user_id, package_id) DO NOTHING;
