import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ClubFeedFilter = 'all' | 'posts' | 'recipes';

export interface ClubFeedItem {
  kind: 'post' | 'recipe';
  id: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  body: string | null;
  recipe_name: string | null;
  recipe_image: string | null;
  recipe_description: string | null;
  ingredients: string | null;
  instructions: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

const PAGE_SIZE = 25;

export const useClubFeed = (filter: ClubFeedFilter) => {
  return useInfiniteQuery({
    queryKey: ['club-feed', filter],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('get_club_feed' as any, {
        _filter: filter,
        _limit: PAGE_SIZE,
        _before: pageParam,
      });
      if (error) throw error;
      return (data ?? []) as ClubFeedItem[];
    },
    getNextPageParam: (last) => (last.length < PAGE_SIZE ? undefined : last[last.length - 1]?.created_at ?? undefined),
    staleTime: 15_000,
  });
};

export interface ClubRankingItem {
  recipe_id: string;
  recipe_name: string;
  recipe_image: string | null;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  likes_count: number;
  created_at: string;
}

export const useClubRanking = (scope: 'month' | 'all') => {
  return useQuery({
    queryKey: ['club-ranking', scope],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_club_ranking' as any, { _scope: scope, _limit: 50 });
      if (error) throw error;
      return (data ?? []) as ClubRankingItem[];
    },
    staleTime: 30_000,
  });
};

export interface ClubRecipeRow {
  id: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  name: string;
  image_url: string | null;
  description: string | null;
  ingredients: string | null;
  instructions: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export const useClubRecipesSearch = (q: string) => {
  return useQuery({
    queryKey: ['club-recipes-search', q],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_club_recipes' as any, { _q: q, _limit: 60 });
      if (error) throw error;
      return (data ?? []) as ClubRecipeRow[];
    },
    staleTime: 20_000,
  });
};

export interface ClubComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
}

export const useClubComments = (targetType: 'post' | 'recipe', targetId: string, enabled = true) => {
  return useQuery({
    queryKey: ['club-comments', targetType, targetId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('club_post_comments')
        .select('id, user_id, body, created_at')
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const profilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', userIds);
        (profs ?? []).forEach((p) => profilesMap.set(p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url }));
      }
      return rows.map((r) => ({
        ...r,
        author_name: profilesMap.get(r.user_id)?.full_name ?? null,
        author_avatar: profilesMap.get(r.user_id)?.avatar_url ?? null,
      })) as ClubComment[];
    },
  });
};

export const useCreateClubPost = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!user) throw new Error('Não autenticado');
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Mensagem vazia');
      const { error } = await supabase.from('club_posts').insert({ user_id: user.id, body: trimmed });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club-feed'] });
    },
  });
};

export const useCreateClubComment = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetType, targetId, body }: { targetType: 'post' | 'recipe'; targetId: string; body: string }) => {
      if (!user) throw new Error('Não autenticado');
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Comentário vazio');
      const { error } = await supabase
        .from('club_post_comments')
        .insert({ user_id: user.id, target_type: targetType, target_id: targetId, body: trimmed });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['club-comments', vars.targetType, vars.targetId] });
      qc.invalidateQueries({ queryKey: ['club-feed'] });
      qc.invalidateQueries({ queryKey: ['club-recipes-search'] });
    },
  });
};

export const useToggleRecipeLike = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (recipeId: string) => {
      if (!user) throw new Error('Não autenticado');
      const { data: existing } = await supabase
        .from('club_recipe_votes')
        .select('id, rating')
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId)
        .maybeSingle();
      if (existing) {
        // toggle off
        const { error } = await supabase.from('club_recipe_votes').delete().eq('id', existing.id);
        if (error) throw error;
        return { liked: false };
      }
      const { error } = await supabase
        .from('club_recipe_votes')
        .insert({ user_id: user.id, recipe_id: recipeId, rating: 1 });
      if (error) throw error;
      return { liked: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club-feed'] });
      qc.invalidateQueries({ queryKey: ['club-ranking'] });
      qc.invalidateQueries({ queryKey: ['club-recipes-search'] });
      qc.invalidateQueries({ queryKey: ['club-my-likes'] });
    },
  });
};

export const useMyClubLikes = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['club-my-likes', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('club_recipe_votes')
        .select('recipe_id')
        .eq('user_id', user!.id)
        .gte('rating', 1);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.recipe_id as string));
    },
    staleTime: 30_000,
  });
};
