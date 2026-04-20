import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from './useUserPlan';

export interface UserEbookAccess {
  ebook_id: string;
  expires_at: string | null;
  is_expired: boolean;
  effective_expires_at: string | null;
}

/** Retorna apenas os IDs (mantém compat com chamadas existentes). */
export const useUserEbooks = () => {
  const { user } = useAuth();
  const { data: planData } = useUserPlan();

  return useQuery({
    queryKey: ['user-ebooks', user?.id, planData?.expires_at, planData?.isVip],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_ebooks')
        .select('ebook_id, expires_at')
        .eq('user_id', user!.id);

      if (error) throw error;

      const now = new Date();
      const vipExpires = planData?.isVip ? planData?.expires_at ?? null : null;

      // Acesso "ativo" = sem expires_at OU ainda no prazo OU VIP cobrindo
      return (data || [])
        .filter((d) => {
          if (!d.expires_at) return true;
          if (new Date(d.expires_at) > now) return true;
          if (vipExpires && new Date(vipExpires) > now) return true;
          return false;
        })
        .map((d) => d.ebook_id);
    },
    enabled: !!user?.id,
  });
};

/** Retorna detalhes de expiração de cada e-book do usuário. */
export const useUserEbooksWithExpiry = () => {
  const { user } = useAuth();

  return useQuery<UserEbookAccess[]>({
    queryKey: ['user-ebooks-expiry', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_ebooks')
        .select('ebook_id, expires_at')
        .eq('user_id', user!.id);
      if (error) throw error;
      const now = new Date();
      return (data || []).map((d) => ({
        ebook_id: d.ebook_id,
        expires_at: d.expires_at,
        is_expired: !!d.expires_at && new Date(d.expires_at) < now,
        effective_expires_at: d.expires_at,
      }));
    },
    enabled: !!user?.id,
  });
};

