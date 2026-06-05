import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClubeBenefit {
  text: string;
}

export interface ClubeSettings {
  id: string;
  full_price: number;
  promo_price: number;
  benefits: ClubeBenefit[];
}

const FALLBACK: ClubeSettings = {
  id: '',
  full_price: 197,
  promo_price: 47,
  benefits: [],
};

export function useClubeSettings() {
  return useQuery<ClubeSettings>({
    queryKey: ['clube-settings'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('clube_settings' as any)
        .select('*')
        .eq('singleton', true)
        .maybeSingle();
      if (!data) return FALLBACK;
      const row = data as any;
      return {
        id: row.id,
        full_price: Number(row.full_price) || 197,
        promo_price: Number(row.promo_price) || 69,
        benefits: Array.isArray(row.benefits) ? row.benefits : [],
      };
    },
  });
}
