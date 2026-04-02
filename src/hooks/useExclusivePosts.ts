import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ExclusivePost {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  cover_image_url: string | null;
  is_published: boolean;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export type ExclusivePostInsert = Omit<ExclusivePost, 'id' | 'created_at' | 'updated_at'>;
export type ExclusivePostUpdate = Partial<ExclusivePostInsert>;

export const useExclusivePosts = (publishedOnly = false) => {
  return useQuery({
    queryKey: ['exclusive-posts', { publishedOnly }],
    queryFn: async () => {
      let query = supabase
        .from('exclusive_posts')
        .select('*')
        .order('display_order', { ascending: true });

      if (publishedOnly) {
        query = query.eq('is_published', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ExclusivePost[];
    },
  });
};

export const useExclusivePost = (id: string) => {
  return useQuery({
    queryKey: ['exclusive-posts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exclusive_posts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ExclusivePost;
    },
    enabled: !!id,
  });
};

export const useCreateExclusivePost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (post: ExclusivePostInsert) => {
      const { data, error } = await supabase
        .from('exclusive_posts')
        .insert(post)
        .select()
        .single();

      if (error) throw error;
      return data as ExclusivePost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusive-posts'] });
      toast({ title: 'Post criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar post', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateExclusivePost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ExclusivePostUpdate }) => {
      const { data: updated, error } = await supabase
        .from('exclusive_posts')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as ExclusivePost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusive-posts'] });
      toast({ title: 'Post atualizado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar post', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteExclusivePost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exclusive_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusive-posts'] });
      toast({ title: 'Post excluído com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir post', description: error.message, variant: 'destructive' });
    },
  });
};
