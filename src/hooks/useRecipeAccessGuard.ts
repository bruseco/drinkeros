import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from './useUserPlan';
import { useHasExclusiveAccess } from './useExclusiveAccess';

const DAILY_LIMIT = 3;
const VIP_ONLY_CHARACTERISTICS = ['Xaropes Artesanais'];

export const isVipOnlyCharacteristic = (chars?: string[] | null) => {
  if (!chars) return false;
  return chars.some((c) => VIP_ONLY_CHARACTERISTICS.includes(c));
};

/**
 * Garda de acesso à receita para usuário Free.
 * - Se for Xaropes Artesanais → bloqueia e manda pra /vip
 * - Se já viu 3 receitas distintas hoje (e não é uma já vista) → bloqueia e manda pra /vip
 * - Caso contrário → registra a visualização do dia e libera
 *
 * Retorna { check } — chame antes de exibir o conteúdo da receita.
 */
export const useRecipeAccessGuard = () => {
  const { user } = useAuth();
  const { data: planData } = useUserPlan();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const check = useCallback(
    async (recipeId: string, characteristics?: string[] | null): Promise<boolean> => {
      if (!user?.id) return true; // sem user, deixa o fluxo padrão decidir
      if (planData?.isVip) return true;

      // Bloqueio de característica
      if (isVipOnlyCharacteristic(characteristics)) {
        navigate('/vip');
        return false;
      }

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
        navigate('/vip');
        return false;
      }

      // Registra a nova visualização
      await supabase
        .from('daily_recipe_views')
        .insert({ user_id: user.id, recipe_id: recipeId });

      qc.invalidateQueries({ queryKey: ['daily-view-count', user.id] });
      return true;
    },
    [user?.id, planData?.isVip, navigate, qc]
  );

  return { check, isVip: !!planData?.isVip, dailyLimit: DAILY_LIMIT };
};
