import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InterestsMetrics {
  profissional: number;
  curticao: number;
  ambos: number;
  nenhum: number;
  total: number;
}

/**
 * Conta usuários por interesse selecionado.
 * Usa COUNT exato no servidor (sem trazer linhas) pra escapar do limite de 1000.
 */
export const useInterestsMetrics = () => {
  return useQuery({
    queryKey: ['interests-metrics'],
    staleTime: 60_000,
    queryFn: async (): Promise<InterestsMetrics> => {
      const profOnly = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .contains('interests', ['profissional'] as any)
        .not('interests', 'cs', '{curticao}');
      const curtOnly = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .contains('interests', ['curticao'] as any)
        .not('interests', 'cs', '{profissional}');
      const ambos = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .contains('interests', ['profissional', 'curticao'] as any);
      const total = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const [r1, r2, r3, r4] = await Promise.all([profOnly, curtOnly, ambos, total]);
      const t = r4.count ?? 0;
      const p = r1.count ?? 0;
      const c = r2.count ?? 0;
      const a = r3.count ?? 0;
      return {
        profissional: p,
        curticao: c,
        ambos: a,
        nenhum: Math.max(0, t - p - c - a),
        total: t,
      };
    },
  });
};
