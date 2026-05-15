import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getPrimaryPhase, matchesPhase, isOutOfSeason } from '@/lib/seasonalPhases';

// Seed that changes on every call to refreshPostsSeed()
let postsSeed = Math.floor(Math.random() * 2147483647);
export function refreshPostsSeed() {
  postsSeed = Math.floor(Math.random() * 2147483647);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  const rng = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

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
  randomOrder?: boolean;
  characteristicFilter?: string;
  /** IDs to push to the end of the list, preserving the given order. */
  pinnedToEndIds?: string[];
}

export const useExclusivePostsPaginated = ({
  search = '',
  pageSize = 30,
  publishedOnly = false,
  randomOrder = false,
  characteristicFilter,
  pinnedToEndIds,
}: PaginatedPostsParams = {}) => {
  const pinnedKey = (pinnedToEndIds ?? []).join(',');
  return useInfiniteQuery({
    queryKey: ['exclusive-posts-paginated', { search, pageSize, publishedOnly, randomOrder, characteristicFilter, seed: randomOrder ? postsSeed : 0, pinnedKey }],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * pageSize;

      if (search.trim()) {
        // Stopwords: termos genéricos que não ajudam a buscar (ex: "drinks com espumante" → busca "espumante")
        const STOPWORDS = new Set([
          'drink', 'drinks', 'bebida', 'bebidas', 'receita', 'receitas',
          'com', 'sem', 'de', 'da', 'do', 'das', 'dos', 'e', 'ou',
          'para', 'pra', 'no', 'na', 'nos', 'nas', 'em', 'a', 'o', 'os', 'as', 'um', 'uma',
        ]);
        const raw = search.trim();
        const tokens = raw.split(/\s+/).filter(Boolean);
        const meaningful = tokens.filter(t => !STOPWORDS.has(t.toLowerCase()));
        // Se removeu alguma stopword e sobrou pelo menos 1 termo, usa só os termos significativos
        // (ex: "drinks com espumante" → "espumante"; "drinks com gin tônica" → "gin tônica")
        const effectiveTerm = meaningful.length > 0 && meaningful.length < tokens.length
          ? meaningful.join(' ')
          : raw;

        const { data, error } = await supabase.rpc('search_exclusive_posts', {
          p_term: effectiveTerm,
          p_published_only: publishedOnly,
          p_limit: pageSize,
          p_offset: from,
        });

        if (error) throw error;

        const posts = (data || []) as (ExclusivePost & { total_count: number })[];
        const total = posts.length > 0 ? Number(posts[0].total_count) : 0;

        return {
          posts: posts.map(({ total_count, ...rest }) => rest) as ExclusivePost[],
          total,
          hasMore: from + pageSize < total,
        };
      }

      if (randomOrder) {
        // Fetch ALL ids + characteristics, shuffle with seed, then aplica boost sazonal,
        // e por fim faz fetch dos detalhes apenas da página atual.
        let allQuery = supabase
          .from('exclusive_posts')
          .select('id, characteristics');

        if (publishedOnly) {
          allQuery = allQuery.eq('is_published', true);
        }
        if (characteristicFilter) {
          allQuery = allQuery.contains('characteristics', [characteristicFilter]);
        }

        const { data: allRows, error: allErr } = await allQuery;
        if (allErr) throw allErr;

        // Filtra drinks sazonais fora de época (Natal, Halloween, Carnaval,
        // Festa Junina, Verão, Inverno só aparecem dentro de suas janelas).
        // Quando o usuário aplica QUALQUER filtro de característica, liberamos
        // todas as tags (busca também libera, mas vai por outro branch via RPC).
        const inSeason = characteristicFilter
          ? ((allRows || []) as { id: string; characteristics: string[] | null }[])
          : ((allRows || []) as { id: string; characteristics: string[] | null }[]).filter(
              (r) => !isOutOfSeason(r.characteristics)
            );

        const shuffled = seededShuffle(inSeason, postsSeed);

        // Boost sazonal: drinks que casam com a fase ativa primária vão para o topo
        // (mantendo ordem aleatória entre si). Quando o usuário filtra por categoria,
        // não aplicamos boost para não desalinhar o filtro escolhido.
        const phase = !characteristicFilter ? getPrimaryPhase() : null;
        let ordered = shuffled;
        if (phase) {
          const hits: typeof shuffled = [];
          const rest: typeof shuffled = [];
          for (const r of shuffled) {
            if (matchesPhase(r.characteristics, phase)) hits.push(r);
            else rest.push(r);
          }
          ordered = [...hits, ...rest];
        }

        // Push viewed/completed recipes to the end, in the given order.
        if (pinnedToEndIds && pinnedToEndIds.length > 0) {
          const pinnedSet = new Set(pinnedToEndIds);
          const rank = new Map(pinnedToEndIds.map((id, i) => [id, i]));
          const notPinned = ordered.filter((r) => !pinnedSet.has(r.id));
          const pinned = ordered
            .filter((r) => pinnedSet.has(r.id))
            .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
          ordered = [...notPinned, ...pinned];
        }

        const total = ordered.length;
        const pageIds = ordered.slice(from, from + pageSize).map((r) => r.id);

        if (pageIds.length === 0) {
          return { posts: [] as ExclusivePost[], total, hasMore: false };
        }

        const { data, error } = await supabase
          .from('exclusive_posts')
          .select('*')
          .in('id', pageIds);

        if (error) throw error;

        // Re-sort to match ordered slice
        const orderMap = new Map(pageIds.map((id, i) => [id, i]));
        const sorted = (data as ExclusivePost[]).sort(
          (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
        );

        return {
          posts: sorted,
          total,
          hasMore: from + pageSize < total,
        };
      }

      // No search, no random — use normal query
      let query = supabase
        .from('exclusive_posts')
        .select('*', { count: 'exact' })
        .order('display_order', { ascending: true })
        .range(from, from + pageSize - 1);

      if (publishedOnly) {
        query = query.eq('is_published', true);
      }
      if (characteristicFilter) {
        query = query.contains('characteristics', [characteristicFilter]);
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const useExclusivePost = (idOrSlug: string) => {
  return useQuery({
    queryKey: ['exclusive-posts', idOrSlug],
    queryFn: async () => {
      const isUuid = UUID_REGEX.test(idOrSlug);
      const { data, error } = await supabase
        .from('exclusive_posts')
        .select('*')
        .eq(isUuid ? 'id' : 'slug', idOrSlug)
        .maybeSingle();

      if (error) throw error;
      return data as ExclusivePost;
    },
    enabled: !!idOrSlug,
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
