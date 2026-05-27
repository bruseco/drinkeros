import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Ebook {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  file_url: string | null;
  price: number | null;
  is_active: boolean;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export type EbookInsert = Omit<Ebook, 'id' | 'created_at' | 'updated_at'>;
export type EbookUpdate = Partial<EbookInsert>;

// Non-sensitive columns visible to clients. `file_url` is intentionally
// excluded — restricted to admins via admin_get_ebook_file_url RPC,
// and users download via the get-signed-file-url edge function.
const EBOOK_PUBLIC_COLS =
  'id, name, slug, description, cover_image_url, price, is_active, display_order, created_at, updated_at';

export const useEbooks = (activeOnly = false) => {
  return useQuery({
    queryKey: ['ebooks', { activeOnly }],
    queryFn: async () => {
      let query = supabase
        .from('ebooks')
        .select(EBOOK_PUBLIC_COLS)
        .order('display_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Ebook[];
    },
  });
};

export const useEbook = (id: string) => {
  return useQuery({
    queryKey: ['ebooks', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebooks')
        .select(EBOOK_PUBLIC_COLS)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Ebook;
    },
    enabled: !!id,
  });
};

export const useEbookBySlug = (slug: string) => {
  return useQuery({
    queryKey: ['ebooks', 'slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebooks')
        .select(EBOOK_PUBLIC_COLS)
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as Ebook | null;
    },
    enabled: !!slug,
  });
};

export const useCreateEbook = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ebook: EbookInsert) => {
      const { data, error } = await supabase
        .from('ebooks')
        .insert(ebook)
        .select('id')
        .single();

      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebooks'] });
      toast({ title: 'E-book criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar e-book', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateEbook = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EbookUpdate }) => {
      const { data: updated, error } = await supabase
        .from('ebooks')
        .update(data)
        .eq('id', id)
        .select('id')
        .single();

      if (error) throw error;
      return updated as { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebooks'] });
      toast({ title: 'E-book atualizado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar e-book', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteEbook = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ebooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebooks'] });
      toast({ title: 'E-book excluído com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir e-book', description: error.message, variant: 'destructive' });
    },
  });
};
