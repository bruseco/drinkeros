import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Interest = 'profissional' | 'curticao';

export const useInterests = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['interests', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<Interest[]> => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('profiles')
        .select('interests')
        .eq('user_id', user.id)
        .maybeSingle();
      const raw = ((data as any)?.interests ?? []) as string[];
      return raw.filter((v): v is Interest => v === 'profissional' || v === 'curticao');
    },
  });
};

export const useUpdateInterests = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (interests: Interest[]) => {
      if (!user?.id) throw new Error('Sem usuário');
      const { error } = await supabase
        .from('profiles')
        .update({ interests } as any)
        .eq('user_id', user.id);
      if (error) throw error;
      return interests;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interests', user?.id] });
    },
  });
};

/** True quando o usuário escolheu APENAS "profissional" (sem curtição). */
export const isProfessionalOnly = (interests: Interest[] | undefined | null): boolean => {
  if (!interests || interests.length === 0) return false;
  return interests.includes('profissional') && !interests.includes('curticao');
};
