
-- ============ profiles.bio ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;

-- ============ Storage buckets ============
INSERT INTO storage.buckets (id, name, public) VALUES ('club-recipes', 'club-recipes', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: club-recipes
CREATE POLICY "Public read club-recipes" ON storage.objects
  FOR SELECT USING (bucket_id = 'club-recipes');
CREATE POLICY "Authenticated upload club-recipes" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'club-recipes' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owner update club-recipes" ON storage.objects
  FOR UPDATE USING (bucket_id = 'club-recipes' AND owner = auth.uid());
CREATE POLICY "Owner delete club-recipes" ON storage.objects
  FOR DELETE USING (bucket_id = 'club-recipes' AND owner = auth.uid());

-- Storage policies: avatars
CREATE POLICY "Public read avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owner update avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND owner = auth.uid());
CREATE POLICY "Owner delete avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND owner = auth.uid());

-- ============ club_recipes ============
CREATE TABLE public.club_recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  image_url text,
  ingredients text NOT NULL,
  instructions text NOT NULL,
  characteristics text[] DEFAULT '{}',
  description text,
  is_reported boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_recipes_user ON public.club_recipes(user_id);
CREATE INDEX idx_club_recipes_created ON public.club_recipes(created_at DESC);

ALTER TABLE public.club_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view visible club recipes"
  ON public.club_recipes FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_hidden = false OR user_id = auth.uid() OR is_admin(auth.uid())));

CREATE POLICY "Users can create own club recipes"
  ON public.club_recipes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own club recipes"
  ON public.club_recipes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own club recipes, admins any"
  ON public.club_recipes FOR DELETE
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE TRIGGER update_club_recipes_updated_at
  BEFORE UPDATE ON public.club_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ club_recipe_votes ============
CREATE TABLE public.club_recipe_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id uuid NOT NULL REFERENCES public.club_recipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, user_id)
);
CREATE INDEX idx_club_votes_recipe ON public.club_recipe_votes(recipe_id);
CREATE INDEX idx_club_votes_user ON public.club_recipe_votes(user_id);

ALTER TABLE public.club_recipe_votes ENABLE ROW LEVEL SECURITY;

-- Function to block self-voting
CREATE OR REPLACE FUNCTION public.block_self_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.club_recipes WHERE id = NEW.recipe_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Você não pode votar na própria receita';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER block_self_vote_trigger
  BEFORE INSERT OR UPDATE ON public.club_recipe_votes
  FOR EACH ROW EXECUTE FUNCTION public.block_self_vote();

CREATE POLICY "Anyone authenticated can view votes"
  ON public.club_recipe_votes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create own votes"
  ON public.club_recipe_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
  ON public.club_recipe_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON public.club_recipe_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ============ club_user_points ============
CREATE TABLE public.club_user_points (
  user_id uuid NOT NULL PRIMARY KEY,
  points integer NOT NULL DEFAULT 0,
  recipes_published integer NOT NULL DEFAULT 0,
  votes_given integer NOT NULL DEFAULT 0,
  votes_received integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view points"
  ON public.club_user_points FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Trigger for awarding points
CREATE OR REPLACE FUNCTION public.award_club_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recipe_owner uuid;
BEGIN
  IF TG_TABLE_NAME = 'club_recipes' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.club_user_points (user_id, points, recipes_published)
      VALUES (NEW.user_id, 5, 1)
      ON CONFLICT (user_id) DO UPDATE
        SET points = club_user_points.points + 5,
            recipes_published = club_user_points.recipes_published + 1,
            updated_at = now();
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.club_user_points
        SET points = GREATEST(points - 5, 0),
            recipes_published = GREATEST(recipes_published - 1, 0),
            updated_at = now()
        WHERE user_id = OLD.user_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'club_recipe_votes' THEN
    IF TG_OP = 'INSERT' THEN
      -- voter +1
      INSERT INTO public.club_user_points (user_id, points, votes_given)
      VALUES (NEW.user_id, 1, 1)
      ON CONFLICT (user_id) DO UPDATE
        SET points = club_user_points.points + 1,
            votes_given = club_user_points.votes_given + 1,
            updated_at = now();
      -- recipe owner +10
      SELECT user_id INTO v_recipe_owner FROM public.club_recipes WHERE id = NEW.recipe_id;
      IF v_recipe_owner IS NOT NULL THEN
        INSERT INTO public.club_user_points (user_id, points, votes_received)
        VALUES (v_recipe_owner, 10, 1)
        ON CONFLICT (user_id) DO UPDATE
          SET points = club_user_points.points + 10,
              votes_received = club_user_points.votes_received + 1,
              updated_at = now();
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.club_user_points
        SET points = GREATEST(points - 1, 0),
            votes_given = GREATEST(votes_given - 1, 0),
            updated_at = now()
        WHERE user_id = OLD.user_id;
      SELECT user_id INTO v_recipe_owner FROM public.club_recipes WHERE id = OLD.recipe_id;
      IF v_recipe_owner IS NOT NULL THEN
        UPDATE public.club_user_points
          SET points = GREATEST(points - 10, 0),
              votes_received = GREATEST(votes_received - 1, 0),
              updated_at = now()
          WHERE user_id = v_recipe_owner;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER award_points_on_recipe
  AFTER INSERT OR DELETE ON public.club_recipes
  FOR EACH ROW EXECUTE FUNCTION public.award_club_points();

CREATE TRIGGER award_points_on_vote
  AFTER INSERT OR DELETE ON public.club_recipe_votes
  FOR EACH ROW EXECUTE FUNCTION public.award_club_points();

-- ============ club_monthly_winners ============
CREATE TABLE public.club_monthly_winners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id uuid NOT NULL REFERENCES public.club_recipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  month_year text NOT NULL UNIQUE, -- e.g. "2026-04"
  avg_rating numeric(3,2) NOT NULL,
  total_votes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_monthly_winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view winners"
  ON public.club_monthly_winners FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage winners"
  ON public.club_monthly_winners FOR ALL
  USING (is_admin(auth.uid()));

-- ============ club_winner_dismissals ============
CREATE TABLE public.club_winner_dismissals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  winner_id uuid NOT NULL REFERENCES public.club_monthly_winners(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, winner_id)
);

ALTER TABLE public.club_winner_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dismissals"
  ON public.club_winner_dismissals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
