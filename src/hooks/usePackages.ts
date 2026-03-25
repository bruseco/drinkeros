import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Package {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  hotmart_product_code: string | null;
  woocommerce_product_id: string | null;
  price: number | null;
  is_active: boolean | null;
  is_free: boolean;
  is_available_for_sale: boolean;
  lesson_order: string;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export type PackageInsert = Omit<Package, 'id' | 'created_at' | 'updated_at' | 'price'>;
export type PackageUpdate = Partial<PackageInsert>;

export const usePackageBySlug = (slug: string) => {
  return useQuery({
    queryKey: ['packages', 'slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as Package;
    },
    enabled: !!slug,
  });
};

export const usePackages = (activeOnly = false) => {
  return useQuery({
    queryKey: ['packages', { activeOnly }],
    queryFn: async () => {
      let query = supabase
        .from('packages')
        .select('*')
        .order('display_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Package[];
    },
  });
};

export const usePackage = (id: string) => {
  return useQuery({
    queryKey: ['packages', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Package;
    },
    enabled: !!id,
  });
};

export const useCreatePackage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (pkg: PackageInsert) => {
      const { data, error } = await supabase
        .from('packages')
        .insert(pkg)
        .select()
        .single();

      if (error) throw error;
      return data as Package;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast({ title: 'Pacote criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar pacote', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdatePackage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PackageUpdate }) => {
      const { data: updated, error } = await supabase
        .from('packages')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as Package;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast({ title: 'Pacote atualizado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar pacote', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeletePackage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('packages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast({ title: 'Pacote excluído com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir pacote', description: error.message, variant: 'destructive' });
    },
  });
};
