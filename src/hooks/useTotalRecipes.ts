import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Total dinâmico de receitas publicadas no app. */
export const TOTAL_RECIPES_FALLBACK = 700;

export const useTotalRecipes = () => {
  return useQuery({
    queryKey: ['total-recipes-published'],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('exclusive_posts')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true);
      if (error) throw error;
      return typeof count === 'number' && count > 0 ? count : TOTAL_RECIPES_FALLBACK;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/** Arredonda para baixo na centena (ex: 703 -> 700) para uso em copy de marketing. */
export const floorToHundred = (n: number) => Math.max(100, Math.floor(n / 100) * 100);
