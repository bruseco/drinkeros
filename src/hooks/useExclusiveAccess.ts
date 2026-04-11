import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useHasExclusiveAccess = (feature: string = 'receitas') => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['exclusive-access', user?.id, feature],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc('has_exclusive_access', {
        _user_id: user.id,
        _feature: feature,
      });
      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });
};

export const useToggleExclusiveAccess = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, feature, grant }: { userId: string; feature: string; grant: boolean }) => {
      if (grant) {
        const { error } = await supabase
          .from('user_exclusive_access')
          .insert({ user_id: userId, feature });
        if (error && !error.message.includes('duplicate')) throw error;
      } else {
        const { error } = await supabase
          .from('user_exclusive_access')
          .delete()
          .eq('user_id', userId)
          .eq('feature', feature);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['exclusive-access'] });
    },
  });
};
