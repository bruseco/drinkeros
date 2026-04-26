
-- 1. Adicionar colunas a club_monthly_winners
ALTER TABLE public.club_monthly_winners
  ADD COLUMN IF NOT EXISTS is_competing_yearly boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS yearly_votes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_avg_rating numeric NOT NULL DEFAULT 0;

-- 2. Tabela de votos anuais (separados dos mensais)
CREATE TABLE IF NOT EXISTS public.club_yearly_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_winner_id uuid NOT NULL REFERENCES public.club_monthly_winners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (monthly_winner_id, user_id)
);

ALTER TABLE public.club_yearly_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view yearly votes"
  ON public.club_yearly_votes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create own yearly votes"
  ON public.club_yearly_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own yearly votes"
  ON public.club_yearly_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own yearly votes"
  ON public.club_yearly_votes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_club_yearly_votes_winner ON public.club_yearly_votes(monthly_winner_id);

-- 3. Tabela de vencedores anuais
CREATE TABLE IF NOT EXISTS public.club_yearly_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE,
  recipe_id uuid NOT NULL REFERENCES public.club_recipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  monthly_winner_id uuid REFERENCES public.club_monthly_winners(id) ON DELETE SET NULL,
  avg_rating numeric NOT NULL,
  total_votes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_yearly_winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view yearly winners"
  ON public.club_yearly_winners FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage yearly winners"
  ON public.club_yearly_winners FOR ALL
  USING (public.is_admin(auth.uid()));

-- 4. Função: receitas que estão valendo voto no mês corrente
CREATE OR REPLACE FUNCTION public.get_current_battle_recipe_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.club_recipes
  WHERE is_hidden = false
    AND date_trunc('month', created_at AT TIME ZONE 'America/Sao_Paulo')
      = date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'));
$$;

-- 5. Recalcula yearly_votes/yearly_avg_rating para um winner
CREATE OR REPLACE FUNCTION public.recalc_yearly_winner_stats(_winner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_avg numeric;
BEGIN
  SELECT COUNT(*), COALESCE(AVG(rating), 0)
  INTO v_count, v_avg
  FROM public.club_yearly_votes WHERE monthly_winner_id = _winner_id;

  UPDATE public.club_monthly_winners
  SET yearly_votes = v_count,
      yearly_avg_rating = ROUND(v_avg::numeric, 2)
  WHERE id = _winner_id;
END;
$$;

-- Trigger para recalcular após voto anual
CREATE OR REPLACE FUNCTION public.on_yearly_vote_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_yearly_winner_stats(OLD.monthly_winner_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_yearly_winner_stats(NEW.monthly_winner_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_yearly_vote_change ON public.club_yearly_votes;
CREATE TRIGGER trg_yearly_vote_change
AFTER INSERT OR UPDATE OR DELETE ON public.club_yearly_votes
FOR EACH ROW EXECUTE FUNCTION public.on_yearly_vote_change();

-- Bloquear voto na própria receita (anual)
CREATE OR REPLACE FUNCTION public.block_self_yearly_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.club_monthly_winners
    WHERE id = NEW.monthly_winner_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Você não pode votar na própria receita';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_self_yearly_vote ON public.club_yearly_votes;
CREATE TRIGGER trg_block_self_yearly_vote
BEFORE INSERT OR UPDATE ON public.club_yearly_votes
FOR EACH ROW EXECUTE FUNCTION public.block_self_yearly_vote();

-- 6. Fechar batalha mensal: registra vencedor do mês passado e promove para anual
CREATE OR REPLACE FUNCTION public.close_monthly_battle(_target_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date;
  v_month_year text;
  v_winner_recipe record;
  v_winner_id uuid;
BEGIN
  -- Por padrão fecha o mês anterior (BRT)
  v_month := COALESCE(
    _target_month,
    (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')) - interval '1 month')::date
  );
  v_month_year := to_char(v_month, 'YYYY-MM');

  -- Se já existe vencedor, retorna
  IF EXISTS (SELECT 1 FROM public.club_monthly_winners WHERE month_year = v_month_year) THEN
    RETURN jsonb_build_object('status', 'already_closed', 'month', v_month_year);
  END IF;

  -- Encontra a receita com maior média (desempate: mais votos, depois mais antiga)
  SELECT r.id, r.user_id,
         COALESCE(AVG(v.rating), 0) AS avg_rating,
         COUNT(v.id) AS total_votes
  INTO v_winner_recipe
  FROM public.club_recipes r
  LEFT JOIN public.club_recipe_votes v ON v.recipe_id = r.id
  WHERE r.is_hidden = false
    AND date_trunc('month', r.created_at AT TIME ZONE 'America/Sao_Paulo') = v_month
  GROUP BY r.id, r.user_id, r.created_at
  HAVING COUNT(v.id) > 0
  ORDER BY AVG(v.rating) DESC NULLS LAST, COUNT(v.id) DESC, r.created_at ASC
  LIMIT 1;

  IF v_winner_recipe.id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_winner', 'month', v_month_year);
  END IF;

  INSERT INTO public.club_monthly_winners
    (recipe_id, user_id, month_year, avg_rating, total_votes, is_competing_yearly)
  VALUES
    (v_winner_recipe.id, v_winner_recipe.user_id, v_month_year,
     ROUND(v_winner_recipe.avg_rating::numeric, 2), v_winner_recipe.total_votes, true)
  RETURNING id INTO v_winner_id;

  RETURN jsonb_build_object(
    'status', 'closed',
    'month', v_month_year,
    'winner_id', v_winner_id,
    'recipe_id', v_winner_recipe.id
  );
END;
$$;

-- 7. Fechar batalha anual: escolhe campeão entre as mensais (por yearly_avg_rating)
CREATE OR REPLACE FUNCTION public.close_yearly_battle(_target_year integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_winner record;
BEGIN
  v_year := COALESCE(
    _target_year,
    EXTRACT(YEAR FROM ((now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 day'))::integer
  );

  IF EXISTS (SELECT 1 FROM public.club_yearly_winners WHERE year = v_year) THEN
    RETURN jsonb_build_object('status', 'already_closed', 'year', v_year);
  END IF;

  SELECT mw.id AS monthly_winner_id, mw.recipe_id, mw.user_id,
         mw.yearly_avg_rating, mw.yearly_votes
  INTO v_winner
  FROM public.club_monthly_winners mw
  WHERE mw.month_year LIKE v_year::text || '-%'
    AND mw.is_competing_yearly = true
    AND mw.yearly_votes > 0
  ORDER BY mw.yearly_avg_rating DESC, mw.yearly_votes DESC, mw.created_at ASC
  LIMIT 1;

  IF v_winner.recipe_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_winner', 'year', v_year);
  END IF;

  INSERT INTO public.club_yearly_winners
    (year, recipe_id, user_id, monthly_winner_id, avg_rating, total_votes)
  VALUES (v_year, v_winner.recipe_id, v_winner.user_id,
          v_winner.monthly_winner_id, v_winner.yearly_avg_rating, v_winner.yearly_votes);

  -- Encerra disputa anual de todas do ano
  UPDATE public.club_monthly_winners
  SET is_competing_yearly = false
  WHERE month_year LIKE v_year::text || '-%';

  RETURN jsonb_build_object('status', 'closed', 'year', v_year, 'recipe_id', v_winner.recipe_id);
END;
$$;
