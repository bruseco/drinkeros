import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ClubTier = 'Bronze' | 'Prata' | 'Ouro' | 'Mestre Mixologista';

export const tierFromPoints = (points: number): ClubTier => {
  if (points >= 500) return 'Mestre Mixologista';
  if (points >= 200) return 'Ouro';
  if (points >= 50) return 'Prata';
  return 'Bronze';
};

export const tierColor = (tier: ClubTier): string => {
  switch (tier) {
    case 'Mestre Mixologista': return 'from-fuchsia-500 to-purple-600';
    case 'Ouro': return 'from-yellow-400 to-amber-500';
    case 'Prata': return 'from-slate-300 to-slate-500';
    default: return 'from-amber-700 to-orange-800';
  }
};

export interface ClubRecipeWithStats {
  id: string;
  user_id: string;
  name: string;
  image_url: string | null;
  ingredients: string;
  instructions: string;
  characteristics: string[] | null;
  description: string | null;
  created_at: string;
  avg_rating: number;
  total_votes: number;
  user_vote: number | null;
  author_name: string | null;
  author_avatar: string | null;
}

export const useClubFeed = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['club-feed', user?.id],
    queryFn: async (): Promise<ClubRecipeWithStats[]> => {
      const { data: recipes, error } = await supabase
        .from('club_recipes')
        .select('*')
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!recipes?.length) return [];

      const recipeIds = recipes.map(r => r.id);
      const userIds = [...new Set(recipes.map(r => r.user_id))];

      const [{ data: votes }, { data: profiles }] = await Promise.all([
        supabase.from('club_recipe_votes').select('recipe_id, rating, user_id').in('recipe_id', recipeIds),
        supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds),
      ]);

      return recipes.map(r => {
        const recipeVotes = (votes || []).filter(v => v.recipe_id === r.id);
        const total = recipeVotes.length;
        const avg = total > 0 ? recipeVotes.reduce((s, v) => s + v.rating, 0) / total : 0;
        const my = user ? recipeVotes.find(v => v.user_id === user.id) : null;
        const profile = (profiles || []).find(p => p.user_id === r.user_id);
        return {
          ...r,
          characteristics: r.characteristics || [],
          avg_rating: avg,
          total_votes: total,
          user_vote: my?.rating || null,
          author_name: profile?.full_name || null,
          author_avatar: profile?.avatar_url || null,
        };
      });
    },
  });
};

export const useClubRanking = () => {
  return useQuery({
    queryKey: ['club-ranking'],
    queryFn: async () => {
      const { data: points, error } = await supabase
        .from('club_user_points')
        .select('*')
        .order('points', { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!points?.length) return [];

      const userIds = points.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      return points.map(p => {
        const profile = (profiles || []).find(pr => pr.user_id === p.user_id);
        return {
          ...p,
          full_name: profile?.full_name || 'Usuário',
          avatar_url: profile?.avatar_url || null,
          tier: tierFromPoints(p.points),
        };
      });
    },
  });
};

export const useClubMyPoints = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['club-my-points', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('club_user_points')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      const points = data?.points || 0;
      return { ...(data || { points: 0, recipes_published: 0, votes_given: 0, votes_received: 0 }), tier: tierFromPoints(points) };
    },
    enabled: !!user,
  });
};

export const useCurrentWinner = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['club-current-winner', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: winner } = await supabase
        .from('club_monthly_winners')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!winner) return null;

      const { data: dismissal } = await supabase
        .from('club_winner_dismissals')
        .select('id')
        .eq('user_id', user.id)
        .eq('winner_id', winner.id)
        .maybeSingle();
      if (dismissal) return null;

      const [{ data: recipe }, { data: profile }] = await Promise.all([
        supabase.from('club_recipes').select('*').eq('id', winner.recipe_id).maybeSingle(),
        supabase.from('profiles').select('full_name, avatar_url, bio').eq('user_id', winner.user_id).maybeSingle(),
      ]);
      return { winner, recipe, profile };
    },
    enabled: !!user,
  });
};
