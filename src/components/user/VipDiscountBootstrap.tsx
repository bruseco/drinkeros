import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';

/**
 * Garante que a janela de desconto do Clube (80% → 50%) seja iniciada assim que
 * o usuário passa a ser Sócio/Vitalício — inclusive quando isso acontece DEPOIS
 * do login (ex.: compra do Pacote RAND, que libera o acesso "receitas" do Clube).
 *
 * Sem isso, o benefício só começava no próximo login.
 */
export const VipDiscountBootstrap: React.FC = () => {
  const { user } = useAuth();
  const { data: plan } = useUserPlan();
  const queryClient = useQueryClient();
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !plan) return;
    if (!plan.isVip) return;
    if (plan.discount_intro_started_at) return;
    if (firedFor.current === user.id) return;

    firedFor.current = user.id;
    supabase
      .rpc('start_vip_discount_window' as any)
      .then(({ error }) => {
        if (error) {
          console.warn('[vip-discount] falha ao iniciar janela:', error.message);
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['user-plan', user.id] });
      });
  }, [user?.id, plan, queryClient]);

  return null;
};

export default VipDiscountBootstrap;
