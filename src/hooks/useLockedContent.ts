import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LockedLesson {
  id: string;
  name: string;
  image_url: string | null;
  display_order: number;
}

export const useLockedModuleLessons = (packageId: string | null) => {
  return useQuery({
    queryKey: ['locked-module-lessons', packageId],
    queryFn: async () => {
      if (!packageId) return [];

      const { data, error } = await supabase.rpc('get_package_recipe_metadata', {
        p_package_id: packageId,
      });

      if (error) throw error;
      return (data || []) as LockedLesson[];
    },
    enabled: !!packageId,
  });
};
