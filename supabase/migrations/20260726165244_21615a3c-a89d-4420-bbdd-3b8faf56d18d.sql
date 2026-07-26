-- 1) club_recipe_votes: remove broad read
DROP POLICY IF EXISTS "Anyone authenticated can view votes" ON public.club_recipe_votes;
CREATE POLICY "Users can view own votes" ON public.club_recipe_votes
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_club_recipe_vote_stats(_recipe_ids uuid[])
RETURNS TABLE (recipe_id uuid, total_votes integer, avg_rating numeric, my_rating integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id,
         COALESCE((SELECT COUNT(*)::int FROM public.club_recipe_votes v WHERE v.recipe_id = r.id), 0),
         COALESCE((SELECT ROUND(AVG(v.rating)::numeric, 2) FROM public.club_recipe_votes v WHERE v.recipe_id = r.id), 0),
         (SELECT v.rating::int FROM public.club_recipe_votes v WHERE v.recipe_id = r.id AND v.user_id = auth.uid() LIMIT 1)
  FROM public.club_recipes r
  WHERE r.id = ANY(_recipe_ids) AND auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_club_recipe_vote_stats(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_club_recipe_vote_stats(uuid[]) TO authenticated, service_role;

-- 2) club_yearly_votes: owner/admin only
DROP POLICY IF EXISTS "Anyone authenticated can view yearly votes" ON public.club_yearly_votes;
CREATE POLICY "Users can view own yearly votes" ON public.club_yearly_votes
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 3) club_user_points: owner/admin only + leaderboard via definer RPC
DROP POLICY IF EXISTS "Anyone authenticated can view points" ON public.club_user_points;
CREATE POLICY "Users can view own points" ON public.club_user_points
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_club_points_leaderboard(_limit integer DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  points integer,
  recipes_published integer,
  votes_given integer,
  votes_received integer,
  full_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.points, p.recipes_published, p.votes_given, p.votes_received,
         pr.full_name, pr.avatar_url
  FROM public.club_user_points p
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE auth.uid() IS NOT NULL
  ORDER BY p.points DESC
  LIMIT LEAST(COALESCE(_limit, 50), 100);
$$;
REVOKE ALL ON FUNCTION public.get_club_points_leaderboard(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_club_points_leaderboard(integer) TO authenticated, service_role;

-- 4) ebooks.file_url must never be readable by clients
REVOKE SELECT (file_url) ON public.ebooks FROM anon, authenticated;
