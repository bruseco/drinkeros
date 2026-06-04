CREATE TABLE IF NOT EXISTS public.app_daily_accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  access_date date NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, access_date)
);

GRANT SELECT, INSERT, UPDATE ON public.app_daily_accesses TO authenticated;
GRANT ALL ON public.app_daily_accesses TO service_role;

ALTER TABLE public.app_daily_accesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own daily app accesses" ON public.app_daily_accesses;
CREATE POLICY "Users can view own daily app accesses"
ON public.app_daily_accesses
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own daily app accesses" ON public.app_daily_accesses;
CREATE POLICY "Users can insert own daily app accesses"
ON public.app_daily_accesses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily app accesses" ON public.app_daily_accesses;
CREATE POLICY "Users can update own daily app accesses"
ON public.app_daily_accesses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_app_daily_accesses_user_date
ON public.app_daily_accesses (user_id, access_date DESC);

CREATE OR REPLACE FUNCTION public.track_app_daily_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_access_date date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.app_daily_accesses (user_id, access_date)
  VALUES (v_user_id, v_access_date)
  ON CONFLICT (user_id, access_date)
  DO UPDATE SET
    last_seen_at = now(),
    hits = public.app_daily_accesses.hits + 1;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.track_app_daily_access() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_demographics_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  gender_data jsonb;
  age_data jsonb;
  interests_data jsonb;
  recurrence_data jsonb;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'masculino', COUNT(*) FILTER (WHERE lower(gender) IN ('masculino','m','male','homem')),
    'feminino',  COUNT(*) FILTER (WHERE lower(gender) IN ('feminino','f','female','mulher')),
    'outro',     COUNT(*) FILTER (WHERE gender IS NOT NULL AND lower(gender) NOT IN ('masculino','m','male','homem','feminino','f','female','mulher')),
    'nao_informado', COUNT(*) FILTER (WHERE gender IS NULL OR gender = ''),
    'total', COUNT(*)
  ) INTO gender_data FROM public.profiles;

  WITH ages AS (
    SELECT CASE WHEN birth_date IS NULL THEN NULL ELSE EXTRACT(YEAR FROM age(birth_date))::int END AS age
    FROM public.profiles
  )
  SELECT jsonb_build_object(
    'menor_18',   COUNT(*) FILTER (WHERE age < 18),
    'de_18_24',   COUNT(*) FILTER (WHERE age BETWEEN 18 AND 24),
    'de_25_34',   COUNT(*) FILTER (WHERE age BETWEEN 25 AND 34),
    'de_35_44',   COUNT(*) FILTER (WHERE age BETWEEN 35 AND 44),
    'de_45_54',   COUNT(*) FILTER (WHERE age BETWEEN 45 AND 54),
    'mais_55',    COUNT(*) FILTER (WHERE age >= 55),
    'nao_informado', COUNT(*) FILTER (WHERE age IS NULL),
    'total', COUNT(*)
  ) INTO age_data FROM ages;

  SELECT jsonb_build_object(
    'profissional', COUNT(*) FILTER (WHERE 'profissional' = ANY(interests) AND NOT ('curticao' = ANY(interests))),
    'curticao',     COUNT(*) FILTER (WHERE 'curticao' = ANY(interests) AND NOT ('profissional' = ANY(interests))),
    'ambos',        COUNT(*) FILTER (WHERE 'profissional' = ANY(interests) AND 'curticao' = ANY(interests)),
    'nenhum',       COUNT(*) FILTER (WHERE COALESCE(array_length(interests,1),0) = 0),
    'total',        COUNT(*)
  ) INTO interests_data FROM public.profiles;

  WITH activity AS (
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.profiles
    WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, access_date AS d
    FROM public.app_daily_accesses
    WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.page_funnel_events
    WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.ux_interactions
    WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (viewed_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.recipe_views
    WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (viewed_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.course_views
    WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (viewed_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.exclusive_post_views
    WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (watched_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.lesson_watch_time
    WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.favorites
    WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (downloaded_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.ebook_downloads
    WHERE user_id IS NOT NULL
  ),
  counts AS (
    SELECT user_id, COUNT(DISTINCT d)::int AS c
    FROM activity
    GROUP BY user_id
  ),
  buckets AS (
    SELECT
      COUNT(*) FILTER (WHERE c = 1) AS b_1,
      COUNT(*) FILTER (WHERE c BETWEEN 2 AND 4) AS b_2_4,
      COUNT(*) FILTER (WHERE c BETWEEN 5 AND 49) AS b_5,
      COUNT(*) FILTER (WHERE c BETWEEN 50 AND 99) AS b_50,
      COUNT(*) FILTER (WHERE c BETWEEN 100 AND 499) AS b_100,
      COUNT(*) FILTER (WHERE c BETWEEN 500 AND 999) AS b_500,
      COUNT(*) FILTER (WHERE c >= 1000) AS b_1000,
      COUNT(*) AS total_users_with_sessions
    FROM counts
  )
  SELECT jsonb_build_object(
    'b_1', COALESCE(b_1, 0),
    'b_2_4', COALESCE(b_2_4, 0),
    'b_5_plus', COALESCE(b_5, 0),
    'b_50_plus', COALESCE(b_50, 0),
    'b_100_plus', COALESCE(b_100, 0),
    'b_500_plus', COALESCE(b_500, 0),
    'b_1000_plus', COALESCE(b_1000, 0),
    'total', COALESCE(total_users_with_sessions, 0)
  ) INTO recurrence_data FROM buckets;

  result := jsonb_build_object(
    'gender', gender_data,
    'age', age_data,
    'interests', interests_data,
    'recurrence', recurrence_data
  );
  RETURN result;
END;
$function$;