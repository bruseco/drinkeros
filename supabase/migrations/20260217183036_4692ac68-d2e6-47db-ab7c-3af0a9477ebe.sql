
CREATE OR REPLACE FUNCTION public.get_retention_metrics(
  p_seven_days_ago timestamptz,
  p_thirty_days_ago timestamptz
) RETURNS json AS $$
  SELECT json_build_object(
    'active_students_7d', (
      SELECT COUNT(DISTINCT rv.user_id)
      FROM recipe_views rv
      WHERE rv.viewed_at >= p_seven_days_ago
      AND rv.user_id NOT IN (SELECT user_id FROM user_roles)
    ),
    'total_students', (
      SELECT COUNT(*)
      FROM profiles p
      WHERE p.user_id NOT IN (SELECT user_id FROM user_roles)
    ),
    'completed_views_7d', (
      SELECT COUNT(*)
      FROM recipe_views
      WHERE completed = true AND viewed_at >= p_seven_days_ago
    ),
    'total_views_7d', (
      SELECT COUNT(*)
      FROM recipe_views
      WHERE viewed_at >= p_seven_days_ago
    ),
    'avg_days_between_access', (
      SELECT ROUND(AVG(gap)::numeric, 1)
      FROM (
        SELECT user_id,
          EXTRACT(EPOCH FROM (viewed_at::timestamp - LAG(viewed_at::timestamp) OVER (PARTITION BY user_id ORDER BY viewed_at))) / 86400.0 AS gap
        FROM (
          SELECT DISTINCT user_id, DATE(viewed_at)::timestamp AS viewed_at
          FROM recipe_views
          WHERE viewed_at >= p_thirty_days_ago
          AND user_id NOT IN (SELECT user_id FROM user_roles)
        ) daily
      ) gaps
      WHERE gap IS NOT NULL AND gap > 0
    ),
    'new_users_7d', (
      SELECT COUNT(*)
      FROM profiles
      WHERE created_at >= p_seven_days_ago
      AND user_id NOT IN (SELECT user_id FROM user_roles)
    ),
    'new_users_without_access_7d', (
      SELECT COUNT(*)
      FROM profiles p
      WHERE p.created_at >= p_seven_days_ago
      AND p.user_id NOT IN (SELECT user_id FROM user_roles)
      AND NOT EXISTS (
        SELECT 1 FROM recipe_views rv WHERE rv.user_id = p.user_id
      )
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public';
