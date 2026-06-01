
CREATE OR REPLACE FUNCTION public.get_demographics_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Gender
  SELECT jsonb_build_object(
    'masculino', COUNT(*) FILTER (WHERE lower(gender) IN ('masculino','m','male','homem')),
    'feminino',  COUNT(*) FILTER (WHERE lower(gender) IN ('feminino','f','female','mulher')),
    'outro',     COUNT(*) FILTER (WHERE gender IS NOT NULL AND lower(gender) NOT IN ('masculino','m','male','homem','feminino','f','female','mulher')),
    'nao_informado', COUNT(*) FILTER (WHERE gender IS NULL OR gender = ''),
    'total', COUNT(*)
  ) INTO gender_data FROM public.profiles;

  -- Age buckets
  WITH ages AS (
    SELECT
      CASE
        WHEN birth_date IS NULL THEN NULL
        ELSE EXTRACT(YEAR FROM age(birth_date))::int
      END AS age
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

  -- Interests
  SELECT jsonb_build_object(
    'profissional', COUNT(*) FILTER (WHERE 'profissional' = ANY(interests) AND NOT ('curticao' = ANY(interests))),
    'curticao',     COUNT(*) FILTER (WHERE 'curticao' = ANY(interests) AND NOT ('profissional' = ANY(interests))),
    'ambos',        COUNT(*) FILTER (WHERE 'profissional' = ANY(interests) AND 'curticao' = ANY(interests)),
    'nenhum',       COUNT(*) FILTER (WHERE COALESCE(array_length(interests,1),0) = 0),
    'total',        COUNT(*)
  ) INTO interests_data FROM public.profiles;

  -- Recurrence buckets (sessions per user via ux_interactions session_start)
  WITH counts AS (
    SELECT user_id, COUNT(*)::int AS c
    FROM public.ux_interactions
    WHERE event_type = 'session_start'
    GROUP BY user_id
  ),
  -- include users with 0 session_start as 1 (at least cadastraram). Actually keep only those with >=1.
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
    'b_1', b_1,
    'b_2_4', b_2_4,
    'b_5_plus', b_5,
    'b_50_plus', b_50,
    'b_100_plus', b_100,
    'b_500_plus', b_500,
    'b_1000_plus', b_1000,
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
$$;

GRANT EXECUTE ON FUNCTION public.get_demographics_metrics() TO authenticated;
