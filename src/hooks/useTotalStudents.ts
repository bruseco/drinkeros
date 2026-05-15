import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Número base + total de pessoas inscritas em qualquer curso (dinâmico). */
export const TOTAL_STUDENTS_FALLBACK = 22355;

export const useTotalStudents = () => {
  return useQuery({
    queryKey: ['total-students-certified'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await (supabase as any).rpc('get_total_students_certified');
      if (error) throw error;
      const n = Number(data);
      return Number.isFinite(n) && n > 0 ? n : TOTAL_STUDENTS_FALLBACK;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
