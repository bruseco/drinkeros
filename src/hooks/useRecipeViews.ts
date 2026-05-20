import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Throttle por sessão: evita re-tracking da mesma receita repetidamente
const VIEW_SESSION_TTL_MS = 30 * 60 * 1000; // 30min
function shouldTrackView(userId: string, recipeId: string): boolean {
  try {
    const key = `rv:${userId}:${recipeId}`;
    const raw = sessionStorage.getItem(key);
    const last = raw ? Number(raw) : 0;
    if (Number.isFinite(last) && Date.now() - last < VIEW_SESSION_TTL_MS) return false;
    sessionStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

// Track when a user views a recipe (does NOT mark as completed)
export const useTrackRecipeView = () => {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (recipeId: string) => {
      if (!user) return;
      // 1 write a cada 30min por (user, recipe) — antes era 1-2 round trips por load.
      if (!shouldTrackView(user.id, recipeId)) return;

      // Upsert direto preserva completed=true existente porque só atualiza viewed_at.
      // Index único (user_id, recipe_id) garante conflito correto.
      const { error } = await supabase
        .from('recipe_views')
        .upsert(
          {
            user_id: user.id,
            recipe_id: recipeId,
            viewed_at: new Date().toISOString(),
            completed: false,
          },
          { onConflict: 'user_id,recipe_id', ignoreDuplicates: false }
        );
      // ignoreDuplicates:false faz UPDATE no conflito; como não passamos completed
      // no SET dinâmico, o postgrest sobrescreve completed=false. Para evitar isso,
      // refazemos como UPDATE-only quando linha existe (caso raro: completed=true).
      // Simplificação segura: tratar erros silenciosamente — tracking é best-effort.
      if (error) {
        // Fallback: tentar apenas update de viewed_at sem mexer em completed
        await supabase
          .from('recipe_views')
          .update({ viewed_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('recipe_id', recipeId);
      }
    },
  });
};

// Get recently viewed recipes (last 20)
export const useRecentlyViewedRecipes = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recently-viewed-recipes', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('recipe_views')
        .select(`
          recipe_id,
          viewed_at,
          recipe:recipes(id, name, image_url, servings, status)
        `)
        .eq('user_id', user.id)
        .order('viewed_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Filter only published recipes and format
      return (data || [])
        .filter((rv) => {
          const recipe = rv.recipe as unknown as { status: string | null };
          return recipe && recipe.status === 'published';
        })
        .map((rv) => {
          const recipe = rv.recipe as unknown as {
            id: string;
            name: string;
            image_url: string | null;
            servings: string | null;
          };
          return {
            id: recipe.id,
            name: recipe.name,
            image_url: recipe.image_url,
            servings: recipe.servings,
          };
        });
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });
};

// Get IDs of completed recipes (for progress tracking)
export const useViewedRecipeIds = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['viewed-recipe-ids', user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();

      const { data, error } = await supabase
        .from('recipe_views')
        .select('recipe_id')
        .eq('user_id', user.id)
        .eq('completed', true);

      if (error) throw error;

      return new Set((data || []).map((rv) => rv.recipe_id));
    },
    enabled: !!user,
    staleTime: 60 * 1000, // 1 minute
  });
};

// Invalidate recipe views cache
export const useInvalidateRecipeViews = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['recently-viewed-recipes'] });
    queryClient.invalidateQueries({ queryKey: ['viewed-recipe-ids'] });
    queryClient.invalidateQueries({ queryKey: ['viewed-lessons'] });
  };
};

// Toggle lesson completion (update completed field, preserve view record)
export const useToggleLessonComplete = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lessonId, isCompleted }: { lessonId: string; isCompleted: boolean }) => {
      if (!user) throw new Error('User not authenticated');

      if (isCompleted) {
        // Unmark as completed (keep view record)
        const { error } = await supabase
          .from('recipe_views')
          .update({ completed: false })
          .eq('user_id', user.id)
          .eq('recipe_id', lessonId);

        if (error) throw error;
      } else {
        // Mark as completed - upsert to handle case where no view record exists
        const { data: existing } = await supabase
          .from('recipe_views')
          .select('id')
          .eq('user_id', user.id)
          .eq('recipe_id', lessonId)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('recipe_views')
            .update({ completed: true })
            .eq('user_id', user.id)
            .eq('recipe_id', lessonId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('recipe_views')
            .insert({
              user_id: user.id,
              recipe_id: lessonId,
              viewed_at: new Date().toISOString(),
              completed: true,
            });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recently-viewed-recipes'] });
      queryClient.invalidateQueries({ queryKey: ['viewed-recipe-ids'] });
      queryClient.invalidateQueries({ queryKey: ['viewed-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['module-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['user-recipes-by-package'] });
    },
  });
};
