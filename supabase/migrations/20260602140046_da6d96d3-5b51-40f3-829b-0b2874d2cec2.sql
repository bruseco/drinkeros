-- Função para reativar a oferta intro do Clube (R$69) após N acessos ao app.
-- Chamada pelo frontend a cada 5 acessos do usuário logado que ainda não é sócio.
-- - Limpa clube_intro_revealed_at para que a animação de revelação rode de novo.
-- - Define clube_intro_eligible_until = now() + 30 minutos.
-- - Não faz nada se a janela atual ainda está ativa.
CREATE OR REPLACE FUNCTION public.retrigger_clube_intro_offer()
RETURNS TABLE (
  clube_intro_eligible_until timestamptz,
  clube_intro_revealed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Janela ainda ativa: devolve o estado atual sem mexer.
  IF v_profile.clube_intro_eligible_until IS NOT NULL
     AND v_profile.clube_intro_eligible_until > now() THEN
    clube_intro_eligible_until := v_profile.clube_intro_eligible_until;
    clube_intro_revealed_at := v_profile.clube_intro_revealed_at;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET clube_intro_eligible_until = now() + interval '30 minutes',
      clube_intro_revealed_at = NULL
  WHERE user_id = v_user
  RETURNING * INTO v_profile;

  clube_intro_eligible_until := v_profile.clube_intro_eligible_until;
  clube_intro_revealed_at := v_profile.clube_intro_revealed_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.retrigger_clube_intro_offer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.retrigger_clube_intro_offer() TO service_role;