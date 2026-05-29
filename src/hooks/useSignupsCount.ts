import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSignupsCount = (from: Date, to: Date) => {
  return useQuery({
    queryKey: ['signups-count', from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });
};
