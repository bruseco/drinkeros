
-- =========================
-- TRACKING TABLES
-- =========================

CREATE TABLE IF NOT EXISTS public.course_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_views_viewed_at ON public.course_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_views_course_id ON public.course_views(course_id);
CREATE INDEX IF NOT EXISTS idx_course_views_user_id ON public.course_views(user_id);

ALTER TABLE public.course_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own course views" ON public.course_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own course views" ON public.course_views
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all course views" ON public.course_views
  FOR SELECT USING (is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.exclusive_post_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exclusive_post_views_viewed_at ON public.exclusive_post_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_exclusive_post_views_post_id ON public.exclusive_post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_exclusive_post_views_user_id ON public.exclusive_post_views(user_id);

ALTER TABLE public.exclusive_post_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own exclusive views" ON public.exclusive_post_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own exclusive views" ON public.exclusive_post_views
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all exclusive views" ON public.exclusive_post_views
  FOR SELECT USING (is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.ebook_downloads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ebook_id UUID NOT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ebook_downloads_at ON public.ebook_downloads(downloaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ebook_downloads_ebook_id ON public.ebook_downloads(ebook_id);

ALTER TABLE public.ebook_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own downloads" ON public.ebook_downloads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own downloads" ON public.ebook_downloads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all downloads" ON public.ebook_downloads
  FOR SELECT USING (is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.lesson_watch_time (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  course_id UUID,
  seconds_watched INTEGER NOT NULL DEFAULT 0,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lesson_watch_time_at ON public.lesson_watch_time(watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_watch_time_course_id ON public.lesson_watch_time(course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_watch_time_user_id ON public.lesson_watch_time(user_id);

ALTER TABLE public.lesson_watch_time ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own watch time" ON public.lesson_watch_time
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own watch time" ON public.lesson_watch_time
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all watch time" ON public.lesson_watch_time
  FOR SELECT USING (is_admin(auth.uid()));

-- =========================
-- AGGREGATED METRICS RPC
-- =========================
CREATE OR REPLACE FUNCTION public.get_access_metrics(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'total_sessions', (
      SELECT COUNT(*) FROM ux_interactions
      WHERE event_type = 'session_start' AND created_at BETWEEN p_from AND p_to
    ),
    'unique_users', (
      SELECT COUNT(DISTINCT user_id) FROM ux_interactions
      WHERE event_type = 'session_start' AND created_at BETWEEN p_from AND p_to
    ),
    'total_watch_seconds', (
      SELECT COALESCE(SUM(seconds_watched), 0) FROM lesson_watch_time
      WHERE watched_at BETWEEN p_from AND p_to
    ),
    'top_courses_views', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT c.id, c.name, c.cover_image_url, COUNT(*) AS views
        FROM course_views cv
        JOIN courses c ON c.id = cv.course_id
        WHERE cv.viewed_at BETWEEN p_from AND p_to
        GROUP BY c.id, c.name, c.cover_image_url
        ORDER BY views DESC LIMIT 20
      ) t
    ),
    'top_courses_watch_time', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT c.id, c.name, c.cover_image_url,
          SUM(lwt.seconds_watched) AS total_seconds,
          COUNT(DISTINCT lwt.user_id) AS unique_users
        FROM lesson_watch_time lwt
        JOIN courses c ON c.id = lwt.course_id
        WHERE lwt.watched_at BETWEEN p_from AND p_to
          AND lwt.course_id IS NOT NULL
        GROUP BY c.id, c.name, c.cover_image_url
        ORDER BY total_seconds DESC LIMIT 20
      ) t
    ),
    'top_exclusive_posts', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT ep.id, ep.title AS name, ep.cover_image_url, COUNT(*) AS views
        FROM exclusive_post_views epv
        JOIN exclusive_posts ep ON ep.id = epv.post_id
        WHERE epv.viewed_at BETWEEN p_from AND p_to
        GROUP BY ep.id, ep.title, ep.cover_image_url
        ORDER BY views DESC LIMIT 20
      ) t
    ),
    'top_active_users', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT pr.user_id, pr.full_name, pr.email, pr.avatar_url, COUNT(*) AS sessions
        FROM ux_interactions ux
        JOIN profiles pr ON pr.user_id = ux.user_id
        WHERE ux.event_type = 'session_start' AND ux.created_at BETWEEN p_from AND p_to
        GROUP BY pr.user_id, pr.full_name, pr.email, pr.avatar_url
        ORDER BY sessions DESC LIMIT 20
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
        SELECT e.id, e.name, e.cover_image_url, COUNT(*) AS downloads
        FROM ebook_downloads ed
        JOIN ebooks e ON e.id = ed.ebook_id
        WHERE ed.downloaded_at BETWEEN p_from AND p_to
        GROUP BY e.id, e.name, e.cover_image_url
        ORDER BY downloads DESC LIMIT 20
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;
