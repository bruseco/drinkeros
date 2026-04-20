import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from './useUserPlan';

interface ExpiredAccess {
  course_ids: Set<string>;
  ebook_ids: Set<string>;
  combo_ids: Set<string>;
}

/**
 * Retorna os IDs de produtos que o usuário possui mas estão expirados
 * (e NÃO cobertos por VIP/vitalício). Útil para exibir badge "Expirado"
 * em vez de "Bloqueado" nos cards e abrir CTA pro /vip.
 */
export const useExpiredAccess = () => {
  const { user } = useAuth();
  const { data: planData } = useUserPlan();

  return useQuery<ExpiredAccess>({
    queryKey: ['expired-access', user?.id, planData?.expires_at, planData?.isVip],
    enabled: !!user?.id,
    queryFn: async () => {
      const empty: ExpiredAccess = {
        course_ids: new Set(),
        ebook_ids: new Set(),
        combo_ids: new Set(),
      };
      if (!user?.id) return empty;

      const now = new Date();
      const vipActive = !!planData?.isVip;
      const vipExpiresAt = vipActive ? planData?.expires_at ?? null : null;
      const vipCovers = vipExpiresAt ? new Date(vipExpiresAt) > now : false;

      const [{ data: lifetime }, { data: courses }, { data: ebooks }, { data: combos }] =
        await Promise.all([
          supabase.from('user_lifetime_access').select('id').eq('user_id', user.id).maybeSingle(),
          supabase.from('user_courses').select('course_id, expires_at').eq('user_id', user.id),
          supabase.from('user_ebooks').select('ebook_id, expires_at').eq('user_id', user.id),
          supabase.from('user_combos').select('combo_id, expires_at').eq('user_id', user.id),
        ]);

      // Vitalício nunca expira
      if (lifetime) return empty;
      // VIP cobre tudo enquanto ativo
      if (vipCovers) return empty;

      const isExpired = (e: string | null) => !!e && new Date(e) < now;

      const result: ExpiredAccess = {
        course_ids: new Set((courses || []).filter((r) => isExpired(r.expires_at)).map((r) => r.course_id)),
        ebook_ids: new Set((ebooks || []).filter((r) => isExpired(r.expires_at)).map((r) => r.ebook_id)),
        combo_ids: new Set((combos || []).filter((r) => isExpired(r.expires_at)).map((r) => r.combo_id)),
      };
      return result;
    },
  });
};
