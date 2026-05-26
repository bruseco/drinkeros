CREATE OR REPLACE FUNCTION public.close_monthly_battle(_target_month date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month date;
  v_month_year text;
  v_winner_recipe record;
  v_winner_id uuid;
  v_min_votes_given constant int := 3;
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
  -- REGRA: o autor precisa ter avaliado pelo menos v_min_votes_given OUTRAS receitas
  -- (distintas, e não a própria) para ser elegível ao prêmio.
  SELECT r.id, r.user_id,
         COALESCE(AVG(v.rating), 0) AS avg_rating,
         COUNT(v.id) AS total_votes
  INTO v_winner_recipe
  FROM public.club_recipes r
  LEFT JOIN public.club_recipe_votes v ON v.recipe_id = r.id
  WHERE r.is_hidden = false
    AND date_trunc('month', r.created_at AT TIME ZONE 'America/Sao_Paulo') = v_month
    AND (
      SELECT COUNT(DISTINCT vv.recipe_id)
      FROM public.club_recipe_votes vv
      JOIN public.club_recipes rr ON rr.id = vv.recipe_id
      WHERE vv.user_id = r.user_id
        AND rr.user_id <> r.user_id
    ) >= v_min_votes_given
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
$function$;