
CREATE OR REPLACE FUNCTION public.is_club_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_plans up
    WHERE up.user_id = _user_id
      AND up.plan IN ('vip','lifetime')
      AND (up.expires_at IS NULL OR up.expires_at > now())
  ) OR EXISTS (
    SELECT 1 FROM public.user_lifetime_access ula WHERE ula.user_id = _user_id
  );
$$;

CREATE TABLE public.club_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  is_hidden boolean NOT NULL DEFAULT false,
  is_reported boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_posts_created ON public.club_posts (created_at DESC);
CREATE INDEX idx_club_posts_user ON public.club_posts (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_posts TO authenticated;
GRANT ALL ON public.club_posts TO service_role;

ALTER TABLE public.club_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club members read posts" ON public.club_posts FOR SELECT TO authenticated
  USING (is_hidden = false AND public.is_club_member(auth.uid()));
CREATE POLICY "admins read all posts" ON public.club_posts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "club members create posts" ON public.club_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_club_member(auth.uid()));
CREATE POLICY "author updates own post" ON public.club_posts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "author deletes own post" ON public.club_posts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "admins manage posts" ON public.club_posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_club_posts_updated BEFORE UPDATE ON public.club_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.club_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('post','recipe')),
  target_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 1000),
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_comments_target ON public.club_post_comments (target_type, target_id, created_at);
CREATE INDEX idx_club_comments_user ON public.club_post_comments (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_post_comments TO authenticated;
GRANT ALL ON public.club_post_comments TO service_role;

ALTER TABLE public.club_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club members read comments" ON public.club_post_comments FOR SELECT TO authenticated
  USING (is_hidden = false AND public.is_club_member(auth.uid()));
CREATE POLICY "admins read all comments" ON public.club_post_comments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "club members create comments" ON public.club_post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_club_member(auth.uid()));
CREATE POLICY "author updates own comment" ON public.club_post_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "author deletes own comment" ON public.club_post_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "admins manage comments" ON public.club_post_comments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_club_comments_updated BEFORE UPDATE ON public.club_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_club_feed(
  _filter text DEFAULT 'all',
  _limit int DEFAULT 30,
  _before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  kind text, id uuid, user_id uuid,
  author_name text, author_avatar text,
  body text,
  recipe_name text, recipe_image text, recipe_description text,
  ingredients text, instructions text,
  likes_count int, comments_count int,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT 'post'::text AS kind, p.id, p.user_id, p.body,
      NULL::text AS recipe_name, NULL::text AS recipe_image, NULL::text AS recipe_description,
      NULL::text AS ingredients, NULL::text AS instructions,
      0 AS likes_count, p.created_at
    FROM public.club_posts p
    WHERE p.is_hidden = false AND (_filter IN ('all','posts'))
      AND (_before IS NULL OR p.created_at < _before)
    UNION ALL
    SELECT 'recipe'::text, r.id, r.user_id, NULL::text,
      r.name, r.image_url, r.description, r.ingredients, r.instructions,
      COALESCE((SELECT COUNT(*)::int FROM public.club_recipe_votes v WHERE v.recipe_id = r.id AND v.rating >= 1), 0),
      r.created_at
    FROM public.club_recipes r
    WHERE r.is_hidden = false AND (_filter IN ('all','recipes'))
      AND (_before IS NULL OR r.created_at < _before)
  )
  SELECT b.kind, b.id, b.user_id, pr.full_name, pr.avatar_url, b.body,
    b.recipe_name, b.recipe_image, b.recipe_description, b.ingredients, b.instructions,
    b.likes_count,
    COALESCE((SELECT COUNT(*)::int FROM public.club_post_comments c
              WHERE c.target_type = b.kind AND c.target_id = b.id AND c.is_hidden = false), 0),
    b.created_at
  FROM base b
  LEFT JOIN public.profiles pr ON pr.user_id = b.user_id
  WHERE public.is_club_member(auth.uid())
  ORDER BY b.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_club_feed(text, int, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_club_recipes(_q text, _limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, user_id uuid, author_name text, author_avatar text,
  name text, image_url text, description text,
  ingredients text, instructions text,
  likes_count int, comments_count int, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.user_id, pr.full_name, pr.avatar_url,
    r.name, r.image_url, r.description, r.ingredients, r.instructions,
    COALESCE((SELECT COUNT(*)::int FROM public.club_recipe_votes v WHERE v.recipe_id = r.id AND v.rating >= 1), 0),
    COALESCE((SELECT COUNT(*)::int FROM public.club_post_comments c
              WHERE c.target_type = 'recipe' AND c.target_id = r.id AND c.is_hidden = false), 0),
    r.created_at
  FROM public.club_recipes r
  LEFT JOIN public.profiles pr ON pr.user_id = r.user_id
  WHERE r.is_hidden = false AND public.is_club_member(auth.uid())
    AND (_q IS NULL OR btrim(_q) = ''
      OR r.name ILIKE '%' || _q || '%'
      OR r.ingredients ILIKE '%' || _q || '%'
      OR r.description ILIKE '%' || _q || '%')
  ORDER BY r.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.search_club_recipes(text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_club_ranking(_scope text DEFAULT 'month', _limit int DEFAULT 50)
RETURNS TABLE (
  recipe_id uuid, recipe_name text, recipe_image text,
  user_id uuid, author_name text, author_avatar text,
  likes_count int, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.image_url, r.user_id, pr.full_name, pr.avatar_url,
    COALESCE((SELECT COUNT(*)::int FROM public.club_recipe_votes v
      WHERE v.recipe_id = r.id AND v.rating >= 1
        AND (_scope <> 'month' OR v.created_at >= date_trunc('month', now()))), 0) AS likes_count,
    r.created_at
  FROM public.club_recipes r
  LEFT JOIN public.profiles pr ON pr.user_id = r.user_id
  WHERE r.is_hidden = false AND public.is_club_member(auth.uid())
    AND (_scope <> 'month' OR r.created_at >= date_trunc('month', now()) - interval '1 month')
  ORDER BY likes_count DESC, r.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.get_club_ranking(text, int) TO authenticated;
