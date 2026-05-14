import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from './useUserPlan';
import { useHasExclusiveAccess } from './useExclusiveAccess';

const DAILY_LIMIT = 1;
const VIP_ONLY_CHARACTERISTICS = ['Xaropes Artesanais'];

export const isVipOnlyCharacteristic = (chars?: string[] | null) => {
  if (!chars) return false;
  return chars.some((c) => VIP_ONLY_CHARACTERISTICS.includes(c));
};

/**
 * Garda de acesso à receita para usuário Free.
 * - Se for Xaropes Artesanais → bloqueia e manda pra /vip
 * - Se já viu 1 receita hoje (e não é a mesma) → bloqueia e manda pra /vip
 * - Caso contrário → registra a visualização do dia e libera
 *
 * Retorna { check } — chame antes de exibir o conteúdo da receita.
 */
export const useRecipeAccessGuard = () => {
  const { user } = useAuth();
  const { data: planData, isLoading: planLoading } = useUserPlan();
  const { data: hasExclusive, isLoading: exclusiveLoading } = useHasExclusiveAccess('receitas');
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Lifetime access conta como acesso pleno (equivalente a VIP para fins de receitas)
  const { data: hasLifetime, isLoading: lifetimeLoading } = useQuery({
    queryKey: ['lifetime-access-self', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('user_lifetime_access')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
  });

  const check = useCallback(
    async (recipeId: string, characteristics?: string[] | null): Promise<boolean> => {
      if (!user?.id) return true; // sem user, deixa o fluxo padrão decidir

      // Enquanto qualquer flag de acesso ainda está carregando, não bloqueia (evita redirect indevido)
      if (planLoading || exclusiveLoading || lifetimeLoading) return true;

      // Acesso pleno às receitas: VIP, Vitalício OU acesso exclusivo "receitas" liberado manualmente
      const hasFullRecipeAccess = !!planData?.isVip || !!hasLifetime || !!hasExclusive;

      // Xaropes: liberado para qualquer um com acesso pleno (inclui usuários importados com acesso manual)
      if (isVipOnlyCharacteristic(characteristics)) {
        if (hasFullRecipeAccess) return true;
        navigate('/clube', { replace: true, state: { from: '/app/receitas' } });
        return false;
      }

      if (hasFullRecipeAccess) return true;

      // Já viu hoje? Permite re-acesso sem contar de novo
      const today = new Date().toISOString().split('T')[0];
      const { data: alreadyViewed } = await supabase
        .from('daily_recipe_views')
        .select('id')
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId)
        .eq('view_date', today)
        .maybeSingle();

      if (alreadyViewed) return true;

      // Conta visualizações de hoje
      const { data: countData } = await supabase.rpc('count_daily_views', {
        _user_id: user.id,
      });
      const count = (countData as number) ?? 0;

      if (count >= DAILY_LIMIT) {
        navigate('/clube', { replace: true, state: { from: '/app/receitas' } });
        return false;
      }

      // Registra a nova visualização
      await supabase
        .from('daily_recipe_views')
        .insert({ user_id: user.id, recipe_id: recipeId });

      qc.invalidateQueries({ queryKey: ['daily-view-count', user.id] });
      return true;
    },
    [user?.id, planData?.isVip, hasExclusive, hasLifetime, planLoading, exclusiveLoading, lifetimeLoading, navigate, qc]
  );

  return { check, isVip: !!planData?.isVip || !!hasLifetime || !!hasExclusive, dailyLimit: DAILY_LIMIT };
};
