import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRef } from 'react';

// Seeded random for stable shuffle within a session
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// Generate a session seed (changes on each page load / navigation)
const sessionSeed = Math.floor(Math.random() * 2147483647);

export interface Recipe {
  id: string;
  name: string;
  image_url: string | null;
  servings: string | null;
}

export interface PaginatedRecipesResult {
  recipes: Recipe[];
  total: number;
  hasMore: boolean;
}

interface UsePaginatedRecipesParams {
  packageId?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

const fetchPaginatedRecipes = async ({
  userId,
  packageId,
  search,
  page,
  pageSize,
  lessonOrder,
}: {
  userId: string;
  packageId?: string | null;
  search?: string;
  page: number;
  pageSize: number;
  lessonOrder?: string;
}): Promise<PaginatedRecipesResult> => {
  // First get user's purchased package IDs
  const { data: userPackages } = await supabase
    .from('user_packages')
    .select('package_id')
    .eq('user_id', userId);

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

  if (packageIds.length === 0) {
    return { recipes: [], total: 0, hasMore: false };
  }

  // Filter by specific package or all user's packages
  const targetPackageIds = packageId ? [packageId] : packageIds;

  // Build query for recipe_packages to get recipe IDs with display_order
  const { data: recipePackagesData } = await supabase
    .from('recipe_packages')
    .select('recipe_id, display_order')
    .in('package_id', targetPackageIds)
    .order('display_order', { ascending: true });

  const recipeIdsOrdered = recipePackagesData || [];
  const uniqueRecipeIds = [...new Set(recipeIdsOrdered.map((rp) => rp.recipe_id))];

  if (uniqueRecipeIds.length === 0) {
    return { recipes: [], total: 0, hasMore: false };
  }

  // Build a map of recipe_id -> display_order (use the first/lowest order found)
  const orderMap = new Map<string, number>();
  for (const rp of recipeIdsOrdered) {
    if (!orderMap.has(rp.recipe_id)) {
      orderMap.set(rp.recipe_id, rp.display_order ?? 0);
    }
  }

  // Build recipe query - fetch all matching, then sort and paginate in JS
  let query = supabase
    .from('recipes')
    .select('id, name, image_url, servings', { count: 'exact' })
    .in('id', uniqueRecipeIds)
    .eq('status', 'published');

  // Server-side search
  if (search && search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }

  const { data, count, error } = await query;

  if (error) throw error;

  // If viewing a specific package, sort by display_order; otherwise shuffle randomly
  let sorted: typeof data;
  if (packageId) {
    const isAsc = lessonOrder !== 'desc';
    sorted = (data || []).sort((a, b) => {
      const orderA = orderMap.get(a.id) ?? 0;
      const orderB = orderMap.get(b.id) ?? 0;
      if (orderA !== orderB) return isAsc ? orderA - orderB : orderB - orderA;
      return a.name.localeCompare(b.name);
    });
  } else {
    // Seeded Fisher-Yates shuffle — stable within session, different across page loads
    sorted = [...(data || [])];
    const rng = seededRandom(sessionSeed);
    for (let i = sorted.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    }
  }

  const total = sorted.length;
  const from = page * pageSize;
  const paged = sorted.slice(from, from + pageSize);
  const hasMore = from + pageSize < total;

  return {
    recipes: paged,
    total,
    hasMore,
  };
};

// Helper: fetch lesson_order for a package
const fetchLessonOrder = async (packageId: string): Promise<string> => {
  const { data } = await supabase
    .from('packages')
    .select('lesson_order')
    .eq('id', packageId)
    .single();
  return (data as any)?.lesson_order || 'asc';
};

// Hook for paginated recipes (desktop)
export const useUserRecipesPaginated = ({
  packageId,
  search = '',
  page = 0,
  pageSize = 24,
  enabled = true,
}: UsePaginatedRecipesParams = {}) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-recipes-paginated', user?.id, packageId, search, page, pageSize],
    queryFn: async () => {
      const lessonOrder = packageId ? await fetchLessonOrder(packageId) : 'asc';
      return fetchPaginatedRecipes({
        userId: user!.id,
        packageId,
        search,
        page,
        pageSize,
        lessonOrder,
      });
    },
    enabled: enabled && !!user,
    staleTime: 30 * 1000, // 30 seconds — allows re-shuffle on navigation
    placeholderData: (previousData) => previousData,
  });
};

// Hook for infinite scroll (mobile)
export const useInfiniteRecipes = ({
  packageId,
  search = '',
  pageSize = 20,
  enabled = true,
}: Omit<UsePaginatedRecipesParams, 'page'> = {}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useInfiniteQuery({
    queryKey: ['user-recipes-infinite', user?.id, packageId, search, pageSize],
    queryFn: async ({ pageParam = 0 }) => {
      const lessonOrder = packageId ? await fetchLessonOrder(packageId) : 'asc';
      return fetchPaginatedRecipes({
        userId: user!.id,
        packageId,
        search,
        page: pageParam,
        pageSize,
        lessonOrder,
      });
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length : undefined,
    initialPageParam: 0,
    enabled: enabled && !!user,
    staleTime: 5 * 60 * 1000,
  });
};

// Prefetch next page for desktop pagination
export const usePrefetchNextPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const prefetchNextPage = async ({
    packageId,
    search,
    currentPage,
    pageSize,
    totalPages,
  }: {
    packageId?: string | null;
    search: string;
    currentPage: number;
    pageSize: number;
    totalPages: number;
  }) => {
    if (!user || currentPage >= totalPages - 1) return;

    await queryClient.prefetchQuery({
      queryKey: ['user-recipes-paginated', user.id, packageId, search, currentPage + 1, pageSize],
      queryFn: () =>
        fetchPaginatedRecipes({
          userId: user.id,
          packageId,
          search,
          page: currentPage + 1,
          pageSize,
        }),
      staleTime: 5 * 60 * 1000,
    });
  };

  return { prefetchNextPage };
};
