import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useExclusivePostsPaginated, refreshPostsSeed } from '@/hooks/useExclusivePosts';
import { Loader2, Search, Wine, GlassWater, Users, Citrus, CupSoda, Martini, IceCream, Snowflake, Droplets, Lock, Coffee, Utensils, Zap, Shuffle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/useDebounce';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

import { useRecipeAccessGuard, isVipOnlyCharacteristic } from '@/hooks/useRecipeAccessGuard';
import { cn } from '@/lib/utils';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaStatus } from '@/hooks/usePwaStatus';
import { shouldShowPwaGate } from '@/components/user/PwaInstallGate';

const CATEGORY_FILTERS = [
  { label: 'Xaropes Artesanais', value: 'Xaropes Artesanais', icon: GlassWater },
  { label: 'Sem Álcool', value: 'Sem Álcool', icon: Droplets },
  { label: 'Drinks de Galera', value: 'Drinks de Galera', icon: Users },
  { label: 'Shots', value: 'Shot', icon: Zap },
  { label: 'Caipirinhas', value: 'Caipirinha', icon: Citrus },
  { label: 'Batidas', value: 'Batida', icon: CupSoda },
  { label: 'Clássicos e Variações', value: 'Clássico', icon: Martini },
  { label: 'Sobremesas', value: 'Sobremesa', icon: IceCream },
  { label: 'Frozens', value: 'Frozen', icon: Snowflake },
  { label: 'Amargos', value: 'Amargo', icon: Coffee },
  { label: 'Salgados', value: 'Salgado', icon: Utensils },
];

const SEARCH_PLACEHOLDERS = [
  'Drinks com vodka',
  'Drinks para piscina',
  'Negroni',
  'Drinks com gin',
  'Margarita',
  'Drinks refrescantes',
  'Drinks com rum',
  'Drinks tropicais',
  'Moscow Mule',
  'Drinks com espumante',
];

const useTypingPlaceholder = (texts: string[], typingSpeed = 80, pauseMs = 2000) => {
  const [display, setDisplay] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const indexRef = useRef(Math.floor(Math.random() * texts.length));
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isFocused || texts.length === 0) return;

    let charIndex = 0;
    let deleting = false;
    let pauseTimeout: number | null = null;
    const current = () => texts[indexRef.current] ?? '';

    const schedule = (callback: () => void, delay: number) => {
      timeoutRef.current = window.setTimeout(callback, delay);
    };

    const tick = () => {
      const activeText = current();

      if (deleting) {
        charIndex = Math.max(charIndex - 1, 0);
        setDisplay(activeText.slice(0, charIndex));

        if (charIndex === 0) {
          deleting = false;
          indexRef.current = (indexRef.current + 1) % texts.length;
          pauseTimeout = window.setTimeout(() => schedule(tick, typingSpeed), 300);
          return;
        }

        schedule(tick, typingSpeed / 2);
        return;
      }

      charIndex = Math.min(charIndex + 1, activeText.length);
      setDisplay(activeText.slice(0, charIndex));

      if (charIndex === activeText.length) {
        deleting = true;
        pauseTimeout = window.setTimeout(() => schedule(tick, typingSpeed / 2), pauseMs);
        return;
      }

      schedule(tick, typingSpeed);
    };

    schedule(tick, typingSpeed);

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      if (pauseTimeout !== null) {
        window.clearTimeout(pauseTimeout);
      }
    };
  }, [isFocused, pauseMs, texts, typingSpeed]);

  return { display, isFocused, setIsFocused };
};

const RECIPES_STATE_KEY = 'user-recipes:list-state';

const UserRecipes: React.FC = () => {
  // Seed persists across navigation within the session — only re-shuffles on full page refresh
  // so users can return to a recipe they had eyed without losing their place.
  const [searchParams] = useSearchParams();
  const persisted = (() => {
    try {
      const raw = sessionStorage.getItem(RECIPES_STATE_KEY);
      return raw ? JSON.parse(raw) as { search?: string; category?: string | null } : null;
    } catch {
      return null;
    }
  })();
  const [search, setSearch] = useState(searchParams.get('q') || persisted?.search || '');
  const [isStuck, setIsStuck] = useState(false);
  const { display: typingPlaceholder, isFocused, setIsFocused } = useTypingPlaceholder(SEARCH_PLACEHOLDERS);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(persisted?.category ?? null);
  const debouncedSearch = useDebounce(search, 300);
  const stickyRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data: planData } = useUserPlan();
  const { isVip: hasFullRecipeAccess, dailyLimit } = useRecipeAccessGuard();
  const isLockedForUser = planData ? !hasFullRecipeAccess : false;
  const { user } = useAuth();
  const pwa = usePwaStatus();
  const [installBannerVisible, setInstallBannerVisible] = useState<boolean>(() =>
    shouldShowPwaGate({ isStandalone: pwa.isStandalone, hasInstalledBefore: pwa.hasInstalledBefore, loading: pwa.loading })
  );
  useEffect(() => {
    setInstallBannerVisible(
      shouldShowPwaGate({ isStandalone: pwa.isStandalone, hasInstalledBefore: pwa.hasInstalledBefore, loading: pwa.loading })
    );
    const onDismiss = () => setInstallBannerVisible(false);
    window.addEventListener('install-banner-dismissed', onDismiss);
    return () => window.removeEventListener('install-banner-dismissed', onDismiss);
  }, [pwa.isStandalone, pwa.hasInstalledBefore, pwa.loading]);

  // Para usuários free: busca quais receitas já foram vistas hoje + total para saber se o limite estourou
  const { data: dailyViews } = useQuery({
    queryKey: ['daily-views-today', user?.id],
    enabled: !!user?.id && isLockedForUser,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('daily_recipe_views')
        .select('recipe_id')
        .eq('user_id', user!.id)
        .eq('view_date', today);
      const ids = new Set((data ?? []).map((r) => r.recipe_id as string));
      return { ids, count: ids.size };
    },
  });
  const limitReached = isLockedForUser && (dailyViews?.count ?? 0) >= dailyLimit;

  // Receitas já visualizadas pelo usuário — vão para o final da lista, ordenadas pela data
  // de visualização (mais antigas primeiro, mais recentes por último).
  const { data: viewedIdsOrdered } = useQuery({
    queryKey: ['exclusive-post-views-ordered', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('exclusive_post_views')
        .select('post_id, viewed_at')
        .eq('user_id', user!.id)
        .order('viewed_at', { ascending: true });
      const seen = new Set<string>();
      const ids: string[] = [];
      for (const row of data ?? []) {
        const id = row.post_id as string;
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
      return ids;
    },
  });

  // Bump para forçar refetch quando o usuário clica em "Embaralhar"
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const handleShuffle = () => {
    refreshPostsSeed();
    setShuffleNonce((n) => n + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: 1, rootMargin: '-1px 0px 0px 0px' }
    );
    // Observe a sentinel element right above the sticky bar
    const sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    el.parentElement?.insertBefore(sentinel, el);
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, []);

  // Persist search/filter so returning from a recipe restores the same list
  useEffect(() => {
    try {
      sessionStorage.setItem(
        RECIPES_STATE_KEY,
        JSON.stringify({ search, category: selectedCategory })
      );
    } catch {}
  }, [search, selectedCategory]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useExclusivePostsPaginated({
    search: debouncedSearch,
    pageSize: 15,
    publishedOnly: true,
    randomOrder: true as const,
    characteristicFilter: selectedCategory || undefined,
    pinnedToEndIds: viewedIdsOrdered,
  });

  const recipes = data?.pages.flatMap((page) => page.posts) ?? [];

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchNextPage(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <div className="space-y-3">
        {/* Category filter chips */}
        <ScrollArea className="w-[100vw] -ml-4 whitespace-nowrap">
          <div className="flex gap-2 pb-1 px-4">
            {CATEGORY_FILTERS.map((cat) => {
              const active = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(active ? null : cat.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border',
                    active
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  <cat.icon className="h-3.5 w-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <div ref={stickyRef} data-shuffle-nonce={shuffleNonce} className="sticky top-0 z-[60] -mx-4 px-4 pt-0 pb-2 -mt-1">
          <div className="mx-auto flex items-center gap-2 rounded-full border border-border/60 bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={isFocused && !search ? 'Buscar...' : typingPlaceholder || 'Buscar...'}
                className="h-10 rounded-full border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                aria-label="Buscar receitas"
              />
            </div>

            {isStuck && (
              <Link to="/app" className="shrink-0 animate-fade-in mr-[7px]" aria-label="Ir para a página inicial">
                <img src={drinkrosLogo} alt="Drinkeros" className="h-5 w-auto object-contain" />
              </Link>
            )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleShuffle}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            aria-label="Embaralhar receitas"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Embaralhar
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-muted p-12 text-center">
            <Wine className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {debouncedSearch ? 'Nenhuma receita encontrada' : 'Nenhuma receita disponível no momento'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {recipes.map((recipe) => {
                const isVipOnly = isLockedForUser && isVipOnlyCharacteristic((recipe as any).characteristics);
                const alreadyViewedToday = dailyViews?.ids.has(recipe.id) ?? false;
                const blockedByLimit = limitReached && !alreadyViewedToday;
                // Visual de bloqueio (cadeado/overlay) somente para Xaropes exclusivos.
                // Quando o limite diário estourar, o card continua igual — só o link já vai pro /clube.
                const showLockOverlay = isVipOnly;
                const target = (isVipOnly || blockedByLimit) ? '/clube' : `/app/receita/${(recipe as any).slug || recipe.id}`;
                return (
                  <Link key={recipe.id} to={target}>
                    <div className="group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative">
                      {recipe.cover_image_url ? (
                        <div className="aspect-video overflow-hidden rounded-2xl relative">
                          <img
                            src={recipe.cover_image_url}
                            alt={recipe.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                          {showLockOverlay && (
                            <>
                              {/* Degradê preto (esquerda) → transparente (direita) para destacar o xarope no lado direito */}
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                  background:
                                    'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.75) 35%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0) 100%)',
                                }}
                              />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                              <div className="rounded-full bg-purple-600/90 p-3 shadow-lg shadow-purple-500/50">
                                <Lock className="h-5 w-5 text-white" />
                              </div>
                              <span className="rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
                                Exclusivo do Clube
                              </span>
                            </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex aspect-video items-center justify-center rounded-2xl bg-muted">
                          <Wine className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {hasNextPage && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      {isLockedForUser && !installBannerVisible && (
        <div className="fixed bottom-[84px] left-0 right-0 z-40 px-3 pb-2 lg:bottom-6 pointer-events-none">
          <div className="mx-auto max-w-md pointer-events-auto rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-500 p-3 shadow-lg shadow-purple-500/30 text-white flex items-center gap-3">
            <div className="shrink-0 rounded-full bg-white/20 p-2">
              <Crown className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] leading-snug font-medium">
                Torne-se membro do Clube: acesse receitas ilimitadas, mais de 40 xaropes artesanais e muito mais.
              </p>
            </div>
            <Link to="/clube" className="shrink-0">
              <Button size="sm" className="bg-white text-purple-700 hover:bg-white/90 font-bold rounded-full h-9 px-4">
                Saiba mais
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserRecipes;
