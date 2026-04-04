import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUserEbooks = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-ebooks', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_ebooks')
        .select('ebook_id')
        .eq('user_id', user!.id);

      if (error) throw error;
      return data.map((d) => d.ebook_id);
    },
    enabled: !!user?.id,
  });
};
