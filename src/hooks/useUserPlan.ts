import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserPlan = 'free' | 'vip';

export interface UserPlanData {
  plan: UserPlan;
  expires_at: string | null;
  isVip: boolean;
  isLifetime: boolean;
}

export const useUserPlan = () => {
  const { user } = useAuth();

  return useQuery<UserPlanData>({
    queryKey: ['user-plan', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user?.id) return { plan: 'free', expires_at: null, isVip: false, isLifetime: false };

      const { data: planRow } = await supabase
        .from('user_plans')
        .select('plan, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: lifetimeRow } = await supabase
        .from('user_lifetime_access')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Admin sempre é tratado como VIP (via função get_user_plan)
      const { data: effectivePlan } = await supabase.rpc('get_user_plan', {
        _user_id: user.id,
      });

      const plan = (effectivePlan as UserPlan) || 'free';
      return {
        plan,
        expires_at: planRow?.expires_at ?? null,
        isVip: plan === 'vip',
        isLifetime: !!lifetimeRow,
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
