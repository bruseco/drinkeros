import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCallback } from 'react';

export const useCollections = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['collections', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
};

export const useCollectionRecipes = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['collection-recipes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      // First check if user has any collections to avoid unnecessary join query
      const { data: cols } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      
      if (!cols || cols.length === 0) return [];

      const { data, error } = await supabase
        .from('collection_recipes')
        .select(`
          id,
          collection_id,
          recipe_id,
          recipe:recipes(id, name, image_url, servings)
        `)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
};

export const useCreateCollection = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('collections')
        .insert({ name, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast({ title: 'Lista criada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar lista', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteCollection = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (collectionId: string) => {
      // Delete recipes in collection first
      await supabase.from('collection_recipes').delete().eq('collection_id', collectionId);
      const { error } = await supabase.from('collections').delete().eq('id', collectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['collection-recipes'] });
      toast({ title: 'Lista excluída!' });
    },
  });
};

export const useAddToCollection = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ collectionId, recipeId }: { collectionId: string; recipeId: string }) => {
      const { error } = await supabase
        .from('collection_recipes')
        .insert({ collection_id: collectionId, recipe_id: recipeId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-recipes'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast({ title: 'Adicionado à lista!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
};

export const useRemoveFromCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ collectionId, recipeId }: { collectionId: string; recipeId: string }) => {
      const { error } = await supabase
        .from('collection_recipes')
        .delete()
        .eq('collection_id', collectionId)
        .eq('recipe_id', recipeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-recipes'] });
    },
  });
};

/**
 * Auto-add a lesson (recipe) to the "Aulas" collection when favorited from a course.
 * Finds or creates the "Aulas" collection, then inserts the recipe (idempotent).
 */
export const useAddToCursosCollection = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipeId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Find or create "Aulas" collection (migrate from old "Cursos" name)
      let { data: existing } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', 'Aulas')
        .maybeSingle();

      // Migrate old "Cursos" collection to "Aulas"
      if (!existing) {
        const { data: oldCollection } = await supabase
          .from('collections')
          .select('id')
          .eq('user_id', user.id)
          .eq('name', 'Cursos')
          .maybeSingle();

        if (oldCollection) {
          await supabase
            .from('collections')
            .update({ name: 'Aulas' })
            .eq('id', oldCollection.id);
          existing = oldCollection;
        }
      }

      let collectionId: string;
      if (existing) {
        collectionId = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from('collections')
          .insert({ name: 'Aulas', user_id: user.id })
          .select('id')
          .single();
        if (error) throw error;
        collectionId = created.id;
      }

      // Check if already in collection
      const { data: alreadyIn } = await supabase
        .from('collection_recipes')
        .select('id')
        .eq('collection_id', collectionId)
        .eq('recipe_id', recipeId)
        .maybeSingle();

      if (!alreadyIn) {
        const { error } = await supabase
          .from('collection_recipes')
          .insert({ collection_id: collectionId, recipe_id: recipeId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['collection-recipes'] });
    },
  });
};
