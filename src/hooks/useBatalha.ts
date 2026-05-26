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

// Helper: retorna 'YYYY-MM' do mês corrente em BRT
const currentMonthYearBRT = (): string => {
  const now = new Date();
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${brt.getFullYear()}-${String(brt.getMonth() + 1).padStart(2, '0')}`;
};

const currentYearBRT = (): number => {
  const now = new Date();
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return brt.getFullYear();
};

const isInCurrentMonthBRT = (iso: string): boolean => {
  const d = new Date(iso);
  const brt = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const my = `${brt.getFullYear()}-${String(brt.getMonth() + 1).padStart(2, '0')}`;
  return my === currentMonthYearBRT();
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
  is_in_battle: boolean;
}

export const useBatalhaFeed = () => {
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
          is_in_battle: isInCurrentMonthBRT(r.created_at),
        };
      });
    },
  });
};

export const useBatalhaRanking = () => {
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

export const useBatalhaMyPoints = () => {
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

// ============ NOVOS HOOKS PARA RANKING MENSAL/ANUAL/GERAL ============

export interface MonthlyRankingItem {
  recipe_id: string;
  user_id: string;
  name: string;
  image_url: string | null;
  avg_rating: number;
  total_votes: number;
  author_name: string | null;
  author_avatar: string | null;
}

export const getCurrentMonthYearBRT = currentMonthYearBRT;

// Ranking de um mês (YYYY-MM). Default = mês corrente.
export const useMonthlyRanking = (monthYear?: string) => {
  const my = monthYear || currentMonthYearBRT();
  return useQuery({
    queryKey: ['club-monthly-ranking', my],
    queryFn: async (): Promise<MonthlyRankingItem[]> => {
      const [year, month] = my.split('-').map(Number);
      const startBrt = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0)).toISOString();
      const endBrt = new Date(Date.UTC(year, month, 1, 3, 0, 0)).toISOString();

      const { data: recipes, error } = await supabase
        .from('club_recipes')
        .select('*')
        .eq('is_hidden', false)
        .gte('created_at', startBrt)
        .lt('created_at', endBrt);
      if (error) throw error;
      if (!recipes?.length) return [];

      const ids = recipes.map(r => r.id);
      const userIds = [...new Set(recipes.map(r => r.user_id))];
      const [{ data: votes }, { data: profiles }] = await Promise.all([
        supabase.from('club_recipe_votes').select('recipe_id, rating').in('recipe_id', ids),
        supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds),
      ]);

      return recipes
        .map(r => {
          const rv = (votes || []).filter(v => v.recipe_id === r.id);
          const total = rv.length;
          const avg = total > 0 ? rv.reduce((s, v) => s + v.rating, 0) / total : 0;
          const profile = (profiles || []).find(p => p.user_id === r.user_id);
          return {
            recipe_id: r.id,
            user_id: r.user_id,
            name: r.name,
            image_url: r.image_url,
            avg_rating: avg,
            total_votes: total,
            author_name: profile?.full_name || null,
            author_avatar: profile?.avatar_url || null,
          };
        })
        .sort((a, b) => b.avg_rating - a.avg_rating || b.total_votes - a.total_votes);
    },
  });
};

// Lista de meses anteriores que já tiveram campeã encerrada (do mais recente p/ o mais antigo)
export const useClosedMonths = () => {
  return useQuery({
    queryKey: ['club-closed-months'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('club_monthly_winners')
        .select('month_year')
        .order('month_year', { ascending: false });
      if (error) throw error;
      return [...new Set((data || []).map(d => d.month_year as string))];
    },
  });
};

export interface YearlyMonthlyChampion {
  monthly_winner_id: string;
  recipe_id: string;
  user_id: string;
  month_year: string;
  name: string;
  image_url: string | null;
  yearly_avg_rating: number;
  yearly_votes: number;
  user_vote: number | null;
  author_name: string | null;
  author_avatar: string | null;
}

// Ranking anual: campeões mensais do ano corrente concorrendo
export const useYearlyRanking = () => {
  const { user } = useAuth();
  const year = currentYearBRT();
  return useQuery({
    queryKey: ['club-yearly-ranking', year, user?.id],
    queryFn: async (): Promise<YearlyMonthlyChampion[]> => {
      const { data: winners, error } = await supabase
        .from('club_monthly_winners')
        .select('*')
        .like('month_year', `${year}-%`)
        .order('month_year', { ascending: true });
      if (error) throw error;
      if (!winners?.length) return [];

      const recipeIds = winners.map(w => w.recipe_id);
      const userIds = [...new Set(winners.map(w => w.user_id))];
      const winnerIds = winners.map(w => w.id);

      const [{ data: recipes }, { data: profiles }, { data: myVotes }] = await Promise.all([
        supabase.from('club_recipes').select('id, name, image_url').in('id', recipeIds),
        supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds),
        user
          ? supabase.from('club_yearly_votes').select('monthly_winner_id, rating').eq('user_id', user.id).in('monthly_winner_id', winnerIds)
          : Promise.resolve({ data: [] as Array<{ monthly_winner_id: string; rating: number }> }),
      ]);

      return winners
        .map(w => {
          const r = (recipes || []).find(x => x.id === w.recipe_id);
          const p = (profiles || []).find(x => x.user_id === w.user_id);
          const mv = (myVotes || []).find((x) => x.monthly_winner_id === w.id);
          return {
            monthly_winner_id: w.id,
            recipe_id: w.recipe_id,
            user_id: w.user_id,
            month_year: w.month_year,
            name: r?.name || 'Receita',
            image_url: r?.image_url || null,
            yearly_avg_rating: Number(w.yearly_avg_rating || 0),
            yearly_votes: w.yearly_votes || 0,
            user_vote: mv?.rating || null,
            author_name: p?.full_name || null,
            author_avatar: p?.avatar_url || null,
          };
        })
        .sort((a, b) => b.yearly_avg_rating - a.yearly_avg_rating || b.yearly_votes - a.yearly_votes);
    },
  });
};

export interface YearlyChampion {
  year: number;
  recipe_id: string;
  user_id: string;
  name: string;
  image_url: string | null;
  avg_rating: number;
  total_votes: number;
  author_name: string | null;
  author_avatar: string | null;
}

// Ranking geral: campeões de cada ano (histórico)
export const useGeneralRanking = () => {
  return useQuery({
    queryKey: ['club-general-ranking'],
    queryFn: async (): Promise<YearlyChampion[]> => {
      const { data: winners, error } = await supabase
        .from('club_yearly_winners')
        .select('*')
        .order('year', { ascending: false });
      if (error) throw error;
      if (!winners?.length) return [];

      const recipeIds = winners.map(w => w.recipe_id);
      const userIds = [...new Set(winners.map(w => w.user_id))];
      const [{ data: recipes }, { data: profiles }] = await Promise.all([
        supabase.from('club_recipes').select('id, name, image_url').in('id', recipeIds),
        supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds),
      ]);

      return winners.map(w => {
        const r = (recipes || []).find(x => x.id === w.recipe_id);
        const p = (profiles || []).find(x => x.user_id === w.user_id);
        return {
          year: w.year,
          recipe_id: w.recipe_id,
          user_id: w.user_id,
          name: r?.name || 'Receita',
          image_url: r?.image_url || null,
          avg_rating: Number(w.avg_rating),
          total_votes: w.total_votes,
          author_name: p?.full_name || null,
          author_avatar: p?.avatar_url || null,
        };
      });
    },
  });
};

// Voto anual em campeão mensal
export const useYearlyVote = () => {
  const { user } = useAuth();
  return {
    vote: async (monthlyWinnerId: string, rating: number) => {
      if (!user) throw new Error('not_authenticated');
      const { error } = await supabase
        .from('club_yearly_votes')
        .upsert({ monthly_winner_id: monthlyWinnerId, user_id: user.id, rating }, { onConflict: 'monthly_winner_id,user_id' });
      if (error) throw error;
    },
  };
};
