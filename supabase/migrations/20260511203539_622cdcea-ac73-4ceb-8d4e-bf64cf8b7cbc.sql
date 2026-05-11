CREATE OR REPLACE FUNCTION public.get_access_metrics(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'total_sessions', (
      SELECT
        (SELECT COUNT(*) FROM course_views WHERE viewed_at BETWEEN p_from AND p_to)
      + (SELECT COUNT(*) FROM exclusive_post_views WHERE viewed_at BETWEEN p_from AND p_to)
      + (SELECT COUNT(*) FROM ebook_downloads WHERE downloaded_at BETWEEN p_from AND p_to)
      + (SELECT COUNT(*) FROM recipe_views WHERE viewed_at BETWEEN p_from AND p_to)
    ),
    'unique_users', (
      SELECT COUNT(DISTINCT user_id) FROM (
        SELECT user_id FROM course_views WHERE viewed_at BETWEEN p_from AND p_to
        UNION
        SELECT user_id FROM exclusive_post_views WHERE viewed_at BETWEEN p_from AND p_to
        UNION
        SELECT user_id FROM ebook_downloads WHERE downloaded_at BETWEEN p_from AND p_to
        UNION
        SELECT user_id FROM recipe_views WHERE viewed_at BETWEEN p_from AND p_to
        UNION
        SELECT user_id FROM lesson_watch_time WHERE watched_at BETWEEN p_from AND p_to
      ) u WHERE user_id IS NOT NULL
    ),
    'total_watch_seconds', (
      SELECT COALESCE(SUM(seconds_watched), 0) FROM lesson_watch_time
      WHERE watched_at BETWEEN p_from AND p_to
    ),
    'top_courses_views', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT c.id, c.name, c.cover_image_url,
          COUNT(cv.id) AS views
        FROM courses c
        LEFT JOIN course_views cv ON cv.course_id = c.id
          AND cv.viewed_at BETWEEN p_from AND p_to
        WHERE c.is_active = true
        GROUP BY c.id, c.name, c.cover_image_url
        ORDER BY views DESC, c.name ASC LIMIT 100
      ) t
    ),
    'top_courses_watch_time', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT c.id, c.name, c.cover_image_url,
          COALESCE(SUM(lwt.seconds_watched), 0)::bigint AS total_seconds,
          COUNT(DISTINCT lwt.user_id) AS unique_users
        FROM courses c
        LEFT JOIN lesson_watch_time lwt ON lwt.course_id = c.id
          AND lwt.watched_at BETWEEN p_from AND p_to
        WHERE c.is_active = true
        GROUP BY c.id, c.name, c.cover_image_url
        ORDER BY total_seconds DESC, c.name ASC LIMIT 100
      ) t
    ),
    'top_exclusive_posts', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT ep.id, ep.title AS name, ep.cover_image_url,
          COUNT(epv.id) AS views
        FROM exclusive_posts ep
        LEFT JOIN exclusive_post_views epv ON epv.post_id = ep.id
          AND epv.viewed_at BETWEEN p_from AND p_to
        WHERE ep.is_published = true
        GROUP BY ep.id, ep.title, ep.cover_image_url
        ORDER BY views DESC, ep.title ASC LIMIT 30
      ) t
    ),
    'top_active_users', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        WITH events AS (
          SELECT user_id, 'sessions'::text AS kind FROM ux_interactions
          WHERE event_type = 'session_start' AND created_at BETWEEN p_from AND p_to
          UNION ALL
          SELECT user_id, 'exclusive_posts' FROM exclusive_post_views
          WHERE viewed_at BETWEEN p_from AND p_to
          UNION ALL
          SELECT user_id, 'lessons' FROM recipe_views
          WHERE viewed_at BETWEEN p_from AND p_to
          UNION ALL
          SELECT user_id, 'courses' FROM course_views
          WHERE viewed_at BETWEEN p_from AND p_to
          UNION ALL
          SELECT user_id, 'ebooks' FROM ebook_downloads
          WHERE downloaded_at BETWEEN p_from AND p_to
          UNION ALL
          SELECT user_id, 'certificates' FROM certificates
          WHERE created_at BETWEEN p_from AND p_to
        ),
        agg AS (
          SELECT
            user_id,
            COUNT(*) AS points,
            COUNT(*) FILTER (WHERE kind = 'sessions') AS sessions,
            COUNT(*) FILTER (WHERE kind = 'exclusive_posts') AS exclusive_posts,
            COUNT(*) FILTER (WHERE kind = 'lessons') AS lessons,
            COUNT(*) FILTER (WHERE kind = 'courses') AS courses,
            COUNT(*) FILTER (WHERE kind = 'ebooks') AS ebooks,
            COUNT(*) FILTER (WHERE kind = 'certificates') AS certificates
          FROM events
          WHERE user_id IS NOT NULL
          GROUP BY user_id
        )
        SELECT
          pr.user_id,
          pr.full_name,
          pr.email,
          pr.avatar_url,
          a.points AS sessions,
          a.points,
          a.sessions AS sessions_count,
          a.exclusive_posts,
          a.lessons,
          a.courses,
          a.ebooks,
          a.certificates
        FROM agg a
        JOIN profiles pr ON pr.user_id = a.user_id
        ORDER BY a.points DESC
        LIMIT 20
      ) t
    ),
    'certificates_generated', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT reference_name AS name, certificate_type AS type, COUNT(*) AS total
        FROM certificates
        WHERE created_at BETWEEN p_from AND p_to
        GROUP BY reference_name, certificate_type
        ORDER BY total DESC LIMIT 20
      ) t
    ),
    'certificates_total', (
      SELECT COUNT(*) FROM certificates WHERE created_at BETWEEN p_from AND p_to
    ),
    'top_ebooks_downloads', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT e.id, e.name, e.cover_image_url,
          COUNT(ed.id) AS downloads
        FROM ebooks e
        LEFT JOIN ebook_downloads ed ON ed.ebook_id = e.id
          AND ed.downloaded_at BETWEEN p_from AND p_to
        WHERE e.is_active = true
        GROUP BY e.id, e.name, e.cover_image_url
        ORDER BY downloads DESC, e.name ASC LIMIT 100
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$function$;