
-- Create a function to get UX metrics for the admin dashboard
CREATE OR REPLACE FUNCTION public.get_ux_metrics()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN '{}'::json;
  END IF;

  SELECT json_build_object(
    'total_sessions', (SELECT count(*) FROM ux_interactions WHERE event_type = 'session_start'),
    'total_views', (SELECT count(*) FROM ux_interactions WHERE event_type = 'upsell_view'),
    'total_clicks', (SELECT count(*) FROM ux_interactions WHERE event_type = 'upsell_click'),
    'unique_users', (SELECT count(DISTINCT user_id) FROM ux_interactions),
    'avg_scroll_depth', (
      SELECT ROUND(AVG((metadata->>'scroll_pct')::numeric), 1)
      FROM ux_interactions WHERE event_type = 'scroll_depth'
    ),
    'ctr', (
      SELECT CASE 
        WHEN (SELECT count(*) FROM ux_interactions WHERE event_type = 'upsell_view') = 0 THEN 0
        ELSE ROUND(
          (SELECT count(*) FROM ux_interactions WHERE event_type = 'upsell_click')::numeric /
          (SELECT count(*) FROM ux_interactions WHERE event_type = 'upsell_view')::numeric * 100, 1
        )
      END
    ),
    'clicks_by_position', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT (metadata->>'position')::int as position, count(*) as clicks
        FROM ux_interactions WHERE event_type = 'upsell_click' AND metadata->>'position' IS NOT NULL
        GROUP BY (metadata->>'position')::int ORDER BY position
      ) t
    ),
    'views_by_position', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT (metadata->>'position')::int as position, count(*) as views
        FROM ux_interactions WHERE event_type = 'upsell_view' AND metadata->>'position' IS NOT NULL
        GROUP BY (metadata->>'position')::int ORDER BY position
      ) t
    ),
    'daily_events', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT date(created_at) as day,
          count(*) FILTER (WHERE event_type = 'session_start') as sessions,
          count(*) FILTER (WHERE event_type = 'upsell_view') as views,
          count(*) FILTER (WHERE event_type = 'upsell_click') as clicks
        FROM ux_interactions
        WHERE created_at >= now() - interval '30 days'
        GROUP BY date(created_at) ORDER BY day DESC LIMIT 30
      ) t
    ),
    'recent_agent_calls', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT user_id, (metadata->>'position')::int as position, created_at
        FROM ux_interactions WHERE event_type = 'upsell_view'
        ORDER BY created_at DESC LIMIT 20
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$function$;
