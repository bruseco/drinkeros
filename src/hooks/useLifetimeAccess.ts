import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useLifetimeAccessUsers = (userIds: string[]) => {
  return useQuery({
    queryKey: ['lifetime-access', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from('user_lifetime_access')
        .select('user_id')
        .in('user_id', userIds);
      if (error) throw error;
      return new Set((data || []).map((d) => d.user_id));
    },
    enabled: userIds.length > 0,
  });
};

export const useToggleLifetimeAccess = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, grant }: { userId: string; grant: boolean }) => {
      if (grant) {
        const { error } = await supabase
          .from('user_lifetime_access')
          .insert({ user_id: userId });
        if (error && !error.message.includes('duplicate')) throw error;
      } else {
        const { error } = await supabase
          .from('user_lifetime_access')
          .delete()
          .eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: (_, { grant }) => {
      queryClient.invalidateQueries({ queryKey: ['lifetime-access'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: grant ? 'Acesso vitalício concedido!' : 'Acesso vitalício removido.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao alterar acesso vitalício', description: error.message, variant: 'destructive' });
    },
  });
};
