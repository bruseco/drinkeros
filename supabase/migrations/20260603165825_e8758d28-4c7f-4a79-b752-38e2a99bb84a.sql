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

  -- Recorrência = nº de DIAS DISTINTOS em que o usuário logado teve qualquer
  -- atividade logada no app. Une todas as fontes de atividade disponíveis
  -- (page_funnel_events só tem user_id quando logado, exclusive_post_views/
  -- recipe_views/course_views/lesson_watch_time/favorites/ebook_downloads
  -- também). ux_interactions sozinho não captura — só rastreia upsell/scroll.
  WITH activity AS (
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.page_funnel_events WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date
    FROM public.ux_interactions WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date
    FROM public.recipe_views WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date
    FROM public.course_views WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date
    FROM public.exclusive_post_views WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date
    FROM public.lesson_watch_time WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date
    FROM public.favorites WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date
    FROM public.ebook_downloads WHERE user_id IS NOT NULL
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
    'b_1', b_1, 'b_2_4', b_2_4, 'b_5_plus', b_5, 'b_50_plus', b_50,
    'b_100_plus', b_100, 'b_500_plus', b_500, 'b_1000_plus', b_1000,
    'total', total_users_with_sessions
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