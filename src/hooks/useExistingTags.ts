import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useExistingTags() {
  return useQuery({
    queryKey: ['existing-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exclusive_posts')
        .select('ingredients, characteristics');
      if (error) throw error;

      const ingredientSet = new Set<string>();
      const characteristicSet = new Set<string>();

      for (const post of data || []) {
        for (const tag of post.ingredients || []) ingredientSet.add(tag);
        for (const tag of post.characteristics || []) characteristicSet.add(tag);
      }

      return {
        ingredients: Array.from(ingredientSet).sort(),
        characteristics: Array.from(characteristicSet).sort(),
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
