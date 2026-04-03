import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  ingredients: string[];
  instructions: string | null;
  characteristics: string[];
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

interface PaginatedPostsParams {
  search?: string;
  pageSize?: number;
  publishedOnly?: boolean;
}

export const useExclusivePostsPaginated = ({
  search = '',
  pageSize = 30,
  publishedOnly = false,
}: PaginatedPostsParams = {}) => {
  return useInfiniteQuery({
    queryKey: ['exclusive-posts-paginated', { search, pageSize, publishedOnly }],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('exclusive_posts')
        .select('*', { count: 'exact' })
        .order('display_order', { ascending: true })
        .range(from, to);

      if (publishedOnly) {
        query = query.eq('is_published', true);
      }

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`title.ilike.${term},ingredients::text.ilike.${term},characteristics::text.ilike.${term}`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        posts: data as ExclusivePost[],
        total: count ?? 0,
        hasMore: from + pageSize < (count ?? 0),
      };
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length : undefined,
    initialPageParam: 0,
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
        .insert(post as any)
        .select()
        .single();

      if (error) throw error;
      return data as ExclusivePost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusive-posts'] });
      toast({ title: 'Receita criada com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar receita', description: error.message, variant: 'destructive' });
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
        .update(data as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as ExclusivePost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusive-posts'] });
      toast({ title: 'Receita atualizada com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar receita', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Receita excluída com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir receita', description: error.message, variant: 'destructive' });
    },
  });
};

export const useBulkCreateExclusivePosts = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (posts: ExclusivePostInsert[]) => {
      const { data, error } = await supabase
        .from('exclusive_posts')
        .insert(posts as any[])
        .select();

      if (error) throw error;
      return data as ExclusivePost[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['exclusive-posts'] });
      toast({ title: `${data.length} receitas importadas com sucesso!` });
    },
    onError: (error) => {
      toast({ title: 'Erro ao importar receitas', description: error.message, variant: 'destructive' });
    },
  });
};
