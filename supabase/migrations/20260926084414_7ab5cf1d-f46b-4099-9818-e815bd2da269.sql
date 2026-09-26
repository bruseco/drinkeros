CREATE OR REPLACE FUNCTION public.issue_course_certificate(_reference_id uuid, _reference_name text)
 RETURNS certificates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _has_access boolean := false;
  _total_lessons int := 0;
  _viewed_lessons int := 0;
  _workload int := 0;
  _student_name text;
  _code text;
  _existing public.certificates;
  _new public.certificates;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _reference_id IS NULL OR coalesce(btrim(_reference_name), '') = '' THEN RAISE EXCEPTION 'invalid_arguments'; END IF;

  SELECT * INTO _existing FROM public.certificates
  WHERE user_id = _user_id AND certificate_type = 'course' AND reference_id = _reference_id LIMIT 1;
  IF FOUND THEN RETURN _existing; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_courses
    WHERE user_id = _user_id AND course_id = _reference_id
      AND (expires_at IS NULL OR expires_at > now()) AND refunded_at IS NULL
  ) OR EXISTS (SELECT 1 FROM public.user_lifetime_access WHERE user_id = _user_id)
    OR public.is_admin(_user_id)
  INTO _has_access;
  IF NOT _has_access THEN RAISE EXCEPTION 'no_course_access'; END IF;

  -- Only published lessons (the ones students can see) count
  WITH course_lessons AS (
    SELECT DISTINCT r.id AS recipe_id, COALESCE(r.duration_seconds, 0) AS dur
    FROM public.course_packages cp
    JOIN public.recipe_packages rp ON rp.package_id = cp.package_id
    JOIN public.recipes r ON r.id = rp.recipe_id
    WHERE cp.course_id = _reference_id AND r.status = 'published'
  )
  SELECT count(*)::int, COALESCE(sum(dur), 0)::int INTO _total_lessons, _workload FROM course_lessons;

  IF _total_lessons = 0 THEN RAISE EXCEPTION 'course_has_no_lessons'; END IF;

  SELECT count(DISTINCT rv.recipe_id)::int INTO _viewed_lessons
  FROM public.recipe_views rv
  WHERE rv.user_id = _user_id
    AND rv.recipe_id IN (
      SELECT DISTINCT r.id FROM public.course_packages cp
      JOIN public.recipe_packages rp ON rp.package_id = cp.package_id
      JOIN public.recipes r ON r.id = rp.recipe_id
      WHERE cp.course_id = _reference_id AND r.status = 'published'
    );

  IF _viewed_lessons < _total_lessons AND NOT public.is_admin(_user_id) THEN
    RAISE EXCEPTION 'course_not_completed';
  END IF;

  SELECT COALESCE(full_name, email, 'Aluno') INTO _student_name FROM public.profiles WHERE user_id = _user_id LIMIT 1;

  LOOP
    _code := 'CRIM-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.certificates WHERE verification_code = _code);
  END LOOP;

  INSERT INTO public.certificates (user_id, certificate_type, reference_id, reference_name, verification_code, completed_at, student_name, workload_seconds)
  VALUES (_user_id, 'course', _reference_id, btrim(_reference_name), _code, now(), _student_name, _workload)
  RETURNING * INTO _new;
  RETURN _new;
END;
$function$;