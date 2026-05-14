import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserPlan = 'free' | 'aluno' | 'socio' | 'vitalicio';

export interface UserPlanData {
  /** Plano oficial: free | aluno | socio | vitalicio */
  plan: UserPlan;
  expires_at: string | null;
  /** Quando o plano (Sócio) foi ativado — usado para janela de desconto intro */
  activated_at: string | null;
  /** Sócio (assinatura ativa) — não inclui Vitalício */
  isSocio: boolean;
  /** Vitalício (concessão manual, sem expiração) */
  isLifetime: boolean;
  /** Aluno (tem ao menos 1 acesso avulso ativo) — não inclui Sócio/Vitalício */
  isAluno: boolean;
  /** Alias retrocompatível: Sócio OU Vitalício */
  isVip: boolean;
}

export const useUserPlan = () => {
  const { user } = useAuth();

  return useQuery<UserPlanData>({
    queryKey: ['user-plan', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user?.id) {
        return {
          plan: 'free',
          expires_at: null,
          activated_at: null,
          isSocio: false,
          isLifetime: false,
          isAluno: false,
          isVip: false,
        };
      }

      const { data: planRow } = await supabase
        .from('user_plans')
        .select('plan, expires_at, activated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: lifetimeRow } = await supabase
        .from('user_lifetime_access')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Plano oficial via hierarquia (Vitalício > Sócio > Aluno > Grátis)
      const { data: effectivePlan } = await supabase.rpc('get_user_plan_v2' as any, {
        _user_id: user.id,
      });

      const plan = ((effectivePlan as UserPlan) || 'free') as UserPlan;
      const isLifetime = !!lifetimeRow || plan === 'vitalicio';
      const isSocio = plan === 'socio';
      const isAluno = plan === 'aluno';
      const isVip = isSocio || isLifetime;

      return {
        plan: isLifetime ? 'vitalicio' : plan,
        expires_at: isLifetime ? null : (planRow?.expires_at ?? null),
        activated_at: (planRow as any)?.activated_at ?? null,
        isSocio,
        isLifetime,
        isAluno,
        isVip,
      };
    },
  });
};

export const useDailyViewCount = () => {
  const { user } = useAuth();

  return useQuery<number>({
    queryKey: ['daily-view-count', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase.rpc('count_daily_views', {
        _user_id: user.id,
      });
      return (data as number) ?? 0;
    },
  });
};
