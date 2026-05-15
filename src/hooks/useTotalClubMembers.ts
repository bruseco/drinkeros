import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Fallback caso a RPC ainda não esteja disponível. */
export const TOTAL_CLUB_MEMBERS_FALLBACK = 700;

/**
 * Total de membros do Clube dos Drinkeros (Sócios ativos + Vitalícios, distinct).
 * Lê via RPC pública `get_total_club_members`.
 */
export const useTotalClubMembers = () => {
  return useQuery({
    queryKey: ['total-club-members'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await (supabase as any).rpc('get_total_club_members');
      if (error) throw error;
      const n = Number(data);
      return Number.isFinite(n) && n > 0 ? n : TOTAL_CLUB_MEMBERS_FALLBACK;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
