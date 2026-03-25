import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Recipe {
  id: string;
  name: string;
  image_url: string | null;
  servings: string | null;
  ingredients: string | null;
  instructions: string | null;
  video_url: string | null;
  material_url: string | null;
  transcript: string | null;
  status: 'draft' | 'published';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeWithPackages extends Recipe {
  recipe_packages: { id: string; package_id: string; display_order: number | null }[];
}

export type RecipeInsert = Omit<Recipe, 'id' | 'created_at' | 'updated_at'>;
export type RecipeUpdate = Partial<RecipeInsert>;

export const useRecipes = (filters?: { status?: string; packageId?: string; search?: string }) => {
  return useQuery({
    queryKey: ['recipes', filters],
    queryFn: async () => {
      let query = supabase
        .from('recipes')
        .select('*, recipe_packages(id, package_id, display_order)')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let recipes = data as RecipeWithPackages[];

      // Filter by package if needed
      if (filters?.packageId) {
        recipes = recipes.filter((r) =>
          r.recipe_packages.some((rp) => rp.package_id === filters.packageId)
        );

        // Sort by display_order when filtered by package
        recipes.sort((a, b) => {
          const orderA = a.recipe_packages.find(rp => rp.package_id === filters.packageId)?.display_order ?? 0;
          const orderB = b.recipe_packages.find(rp => rp.package_id === filters.packageId)?.display_order ?? 0;
          return orderA - orderB;
        });
      }

      return recipes;
    },
  });
};

export const useRecipe = (id: string) => {
  return useQuery({
    queryKey: ['recipes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*, recipe_packages(id, package_id, display_order)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as RecipeWithPackages;
    },
    enabled: !!id,
  });
};

export const useCreateRecipe = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      recipe,
      packageData,
    }: {
      recipe: RecipeInsert;
      packageData: { packageId: string; displayOrder: number }[];
    }) => {
      // Create recipe
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert(recipe)
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Link to packages with display_order
      if (packageData.length > 0) {
        const { error: linkError } = await supabase.from('recipe_packages').insert(
          packageData.map(({ packageId, displayOrder }) => ({
            recipe_id: newRecipe.id,
            package_id: packageId,
            display_order: displayOrder,
          }))
        );

        if (linkError) throw linkError;
      }

      return newRecipe as Recipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({ title: 'Receita criada com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar receita', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateRecipe = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      data,
      packageData,
    }: {
      id: string;
      data: RecipeUpdate;
      packageData?: { packageId: string; displayOrder: number }[];
    }) => {
      // Update recipe
      const { data: updated, error: recipeError } = await supabase
        .from('recipes')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Update package links if provided (diff-based)
      if (packageData !== undefined) {
        // Fetch existing links
        const { data: existingLinks } = await supabase
          .from('recipe_packages')
          .select('id, package_id, display_order')
          .eq('recipe_id', id);

        const existing = existingLinks || [];
        const newPackageIds = new Set(packageData.map(p => p.packageId));
        const existingMap = new Map(existing.map(e => [e.package_id, e]));

        // Delete removed links
        const toDelete = existing.filter(e => !newPackageIds.has(e.package_id));
        if (toDelete.length > 0) {
          const { error: delError } = await supabase
            .from('recipe_packages')
            .delete()
            .in('id', toDelete.map(d => d.id));
          if (delError) throw delError;
        }

        // Insert new links
        const toInsert = packageData.filter(p => !existingMap.has(p.packageId));
        if (toInsert.length > 0) {
          const { error: insError } = await supabase.from('recipe_packages').insert(
            toInsert.map(({ packageId, displayOrder }) => ({
              recipe_id: id,
              package_id: packageId,
              display_order: displayOrder,
            }))
          );
          if (insError) throw insError;
        }

        // Update display_order for existing links where it changed
        const toUpdate = packageData.filter(p => {
          const ex = existingMap.get(p.packageId);
          return ex && (ex.display_order ?? 0) !== p.displayOrder;
        });
        for (const item of toUpdate) {
          const ex = existingMap.get(item.packageId)!;
          const { error: updError } = await supabase
            .from('recipe_packages')
            .update({ display_order: item.displayOrder })
            .eq('id', ex.id);
          if (updError) throw updError;
        }
      }

      return updated as Recipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({ title: 'Receita atualizada com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar receita', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateRecipeOrder = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      // Batch update display_order for each recipe_package row
      const promises = updates.map(({ id, display_order }) =>
        supabase
          .from('recipe_packages')
          .update({ display_order })
          .eq('id', id)
      );

      const results = await Promise.all(promises);
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao reordenar', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteRecipe = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({ title: 'Receita excluída com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir receita', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDuplicateRecipe = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get original recipe
      const { data: original, error: fetchError } = await supabase
        .from('recipes')
        .select('*, recipe_packages(package_id)')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Create duplicate
      const { data: duplicate, error: createError } = await supabase
        .from('recipes')
        .insert({
          name: `${original.name} (Cópia)`,
          image_url: original.image_url,
          servings: original.servings,
          ingredients: original.ingredients,
          instructions: original.instructions,
          video_url: original.video_url,
          material_url: original.material_url,
          transcript: original.transcript,
          status: 'draft',
          created_by: original.created_by,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Link to same packages
      const packageIds = (original.recipe_packages || []).map((rp: { package_id: string }) => rp.package_id);
      if (packageIds.length > 0) {
        await supabase.from('recipe_packages').insert(
          packageIds.map((packageId: string) => ({
            recipe_id: duplicate.id,
            package_id: packageId,
          }))
        );
      }

      return duplicate as Recipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({ title: 'Receita duplicada com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao duplicar receita', description: error.message, variant: 'destructive' });
    },
  });
};
