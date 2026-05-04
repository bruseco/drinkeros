import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export interface UserPackageWithDetails {
  id: string;
  package_id: string;
  purchased_at: string;
  package: {
    id: string;
    name: string;
    description: string | null;
    cover_image_url: string | null;
  };
}

export const useUserPackages = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-packages', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get purchased packages
      const { data: purchasedData, error: purchasedError } = await supabase
        .from('user_packages')
        .select(`
          id,
          package_id,
          purchased_at,
          package:packages(id, name, description, cover_image_url)
        `)
        .eq('user_id', user.id);

      if (purchasedError) throw purchasedError;
      const purchased = (purchasedData || []) as unknown as UserPackageWithDetails[];

      // Get free packages
      const { data: freePackages, error: freeError } = await supabase
        .from('packages')
        .select('id, name, description, cover_image_url')
        .eq('is_free', true)
        .eq('is_active', true);

      if (freeError) throw freeError;

      // Combine, avoiding duplicates (user may have purchased a free package too)
      const purchasedIds = new Set(purchased.map(p => p.package_id));
      const freeAsUserPackages: UserPackageWithDetails[] = (freePackages || [])
        .filter(fp => !purchasedIds.has(fp.id))
        .map(fp => ({
          id: `free-${fp.id}`,
          package_id: fp.id,
          purchased_at: new Date().toISOString(),
          package: {
            id: fp.id,
            name: fp.name,
            description: fp.description,
            cover_image_url: fp.cover_image_url,
          },
        }));

      return [...purchased, ...freeAsUserPackages];
    },
    enabled: !!user,
  });
};

export const useUserRecipes = (packageId?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-recipes', user?.id, packageId],
    queryFn: async () => {
      if (!user) return [];

      // Get user's purchased packages
      const { data: userPackages } = await supabase
        .from('user_packages')
        .select('package_id')
        .eq('user_id', user.id);

      const purchasedIds = userPackages?.map((up) => up.package_id) || [];

      // Get free package IDs
      const { data: freePackages } = await supabase
        .from('packages')
        .select('id')
        .eq('is_free', true)
        .eq('is_active', true);

      const freeIds = freePackages?.map((fp) => fp.id) || [];

      // Combine unique package IDs
      const packageIds = [...new Set([...purchasedIds, ...freeIds])];

      if (packageIds.length === 0) return [];

      // Get recipes from those packages
      let query = supabase
        .from('recipes')
        .select(`
          *,
          recipe_packages!inner(package_id)
        `)
        .eq('status', 'published');

      if (packageId) {
        query = query.eq('recipe_packages.package_id', packageId);
      } else {
        query = query.in('recipe_packages.package_id', packageIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Remove duplicates (recipe may be in multiple packages)
      const uniqueRecipes = Array.from(
        new Map(data.map((r) => [r.id, r])).values()
      );

      return uniqueRecipes;
    },
    enabled: !!user,
  });
};

export interface PackageWithRecipes {
  package: {
    id: string;
    name: string;
    cover_image_url: string | null;
  };
  recipes: Array<{
    id: string;
    name: string;
    image_url: string | null;
    servings: string | null;
    display_order: number;
  }>;
}

export const useUserRecipesByPackage = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-recipes-by-package', user?.id],
    queryFn: async () => {
      if (!user) return { sections: [], viewedIds: new Set<string>() };

      // Get user's purchased packages with package details
      const { data: userPackages, error: pkgError } = await supabase
        .from('user_packages')
        .select(`
          package_id,
          package:packages(id, name, cover_image_url, display_order, lesson_order)
        `)
        .eq('user_id', user.id);

      if (pkgError) throw pkgError;

      // Get free packages
      const { data: freePackages, error: freeError } = await supabase
        .from('packages')
        .select('id, name, cover_image_url, display_order, lesson_order')
        .eq('is_free', true)
        .eq('is_active', true);

      if (freeError) throw freeError;

      // Combine purchased + free, avoiding duplicates
      const purchasedIds = new Set((userPackages || []).map(up => up.package_id));
      const allPackageEntries = [
        ...(userPackages || []).map(up => ({
          package_id: up.package_id,
          package: up.package,
        })),
        ...(freePackages || [])
          .filter(fp => !purchasedIds.has(fp.id))
          .map(fp => ({
            package_id: fp.id,
            package: fp,
          })),
      ];

      if (allPackageEntries.length === 0) return { sections: [], viewedIds: new Set<string>() };

      // Get all recipes from all packages
      const packageIds = allPackageEntries.map((up) => up.package_id);
      
      const { data: recipePackages, error: rpError } = await supabase
        .from('recipe_packages')
        .select(`
          package_id,
          display_order,
          recipe:recipes(id, name, image_url, servings, status)
        `)
        .in('package_id', packageIds);

      if (rpError) throw rpError;

      // Get completed recipe IDs (only explicitly completed ones)
      const { data: viewedRecipes } = await supabase
        .from('recipe_views')
        .select('recipe_id')
        .eq('user_id', user.id)
        .eq('completed', true);

      const viewedIds = new Set((viewedRecipes || []).map((rv) => rv.recipe_id));

      // Group recipes by package
      const packageMap = new Map<string, PackageWithRecipes & { lesson_order: string }>();

      for (const up of allPackageEntries) {
        const pkg = up.package as unknown as { id: string; name: string; cover_image_url: string | null; display_order: number | null; lesson_order: string };
        if (pkg) {
          packageMap.set(pkg.id, {
            package: { id: pkg.id, name: pkg.name, cover_image_url: pkg.cover_image_url },
            recipes: [],
            lesson_order: pkg.lesson_order || 'asc',
          });
        }
      }

      for (const rp of recipePackages || []) {
        const recipe = rp.recipe as unknown as { id: string; name: string; image_url: string | null; servings: string | null; status: string | null };
        if (recipe && recipe.status === 'published') {
          const pkgData = packageMap.get(rp.package_id);
          if (pkgData) {
            const existing = pkgData.recipes.find(r => r.id === recipe.id);
            if (!existing) {
              pkgData.recipes.push({
                id: recipe.id,
                name: recipe.name,
                image_url: recipe.image_url,
                servings: recipe.servings,
                display_order: rp.display_order ?? 0,
              });
            }
          }
        }
      }

      // Sort packages by display_order
      const sortedPackages = allPackageEntries
        .map((up) => {
          const pkg = up.package as unknown as { id: string; display_order: number | null };
          return { id: up.package_id, order: pkg?.display_order ?? 0 };
        })
        .sort((a, b) => a.order - b.order);

      const sections = sortedPackages
        .map((p) => packageMap.get(p.id))
        .filter((p): p is PackageWithRecipes & { lesson_order: string } => !!p && p.recipes.length > 0);

      return { sections, viewedIds };
    },
    enabled: !!user,
    select: (data) => {
      const sections = data.sections.map((section) => {
        const isAsc = section.lesson_order !== 'desc';
        return {
          ...section,
          recipes: [...section.recipes].sort((a, b) =>
            isAsc ? a.display_order - b.display_order : b.display_order - a.display_order
          ),
        };
      });
      return { sections, viewedIds: data.viewedIds };
    },
  });
};

export const useFavorites = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('favorites')
        .select('id, recipe_id, created_at')
        .eq('user_id', user.id);

      if (error) throw error;

      if (!data || data.length === 0) return [];

      const recipeIds = data.map((f) => f.recipe_id);

      // Try to fetch from recipes (aulas) and exclusive_posts (receitas de drink)
      const [recipesRes, postsRes] = await Promise.all([
        supabase.from('recipes').select('id, name, image_url, servings').in('id', recipeIds),
        supabase.from('exclusive_posts').select('id, title, cover_image_url').in('id', recipeIds),
      ]);

      const recipesMap = new Map((recipesRes.data || []).map((r) => [r.id, r]));
      const postsMap = new Map((postsRes.data || []).map((p) => [p.id, p]));

      return data.map((fav) => {
        const recipe = recipesMap.get(fav.recipe_id);
        const post = postsMap.get(fav.recipe_id);
        return {
          ...fav,
          kind: recipe ? ('aula' as const) : post ? ('receita' as const) : null,
          recipe: recipe
            ? { id: recipe.id, name: recipe.name, image_url: recipe.image_url, servings: recipe.servings }
            : post
            ? { id: post.id, name: post.title, image_url: post.cover_image_url, servings: null }
            : null,
        };
      });
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });
};

export const useToggleFavorite = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ recipeId, isFavorite }: { recipeId: string; isFavorite: boolean }) => {
      if (!user) throw new Error('Not authenticated');

      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('recipe_id', recipeId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, recipe_id: recipeId });

        if (error) throw error;
      }
    },
    onSuccess: (_, { isFavorite }) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast({
        title: isFavorite ? 'Eliminado de favoritos' : 'Agregado a favoritos',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useShoppingList = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['shopping-list', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useAddToShoppingList = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ itemText, recipeId }: { itemText: string; recipeId?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('shopping_list_items').insert({
        user_id: user.id,
        item_text: itemText,
        recipe_id: recipeId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      toast({ title: 'Artículo agregado a la lista' });
    },
    onError: (error) => {
      toast({
        title: 'Error al agregar artículo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useToggleShoppingItem = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, isChecked }: { id: string; isChecked: boolean }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('shopping_list_items')
        .update({ is_checked: !isChecked })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });
};

export const useDeleteShoppingItem = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });
};

export const useClearCheckedItems = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('user_id', user.id)
        .eq('is_checked', true);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      toast({ title: 'Artículos marcados eliminados' });
    },
  });
};
