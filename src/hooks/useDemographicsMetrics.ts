import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DemographicsMetrics {
  gender: {
    masculino: number;
    feminino: number;
    outro: number;
    nao_informado: number;
    total: number;
  };
  age: {
    menor_18: number;
    de_18_24: number;
    de_25_34: number;
    de_35_44: number;
    de_45_54: number;
    mais_55: number;
    nao_informado: number;
    total: number;
  };
  interests: {
    profissional: number;
    curticao: number;
    ambos: number;
    nenhum: number;
    total: number;
  };
  recurrence: {
    b_1: number;
    b_2_4: number;
    b_5_plus: number;
    b_50_plus: number;
    b_100_plus: number;
    b_500_plus: number;
    b_1000_plus: number;
    total: number;
  };
}

export const useDemographicsMetrics = () => {
  return useQuery({
    queryKey: ['demographics-metrics'],
    staleTime: 60_000,
    queryFn: async (): Promise<DemographicsMetrics> => {
      const { data, error } = await (supabase as any).rpc('get_demographics_metrics');
      if (error) throw error;
      return data as DemographicsMetrics;
    },
  });
};
