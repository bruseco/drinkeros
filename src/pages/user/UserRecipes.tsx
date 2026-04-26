import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useExclusivePostsPaginated } from '@/hooks/useExclusivePosts';
import { Loader2, Search, Wine, GlassWater, Users, Citrus, CupSoda, Martini, IceCream, Snowflake, Droplets, Lock, Coffee, Utensils } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/useDebounce';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

import { useRecipeAccessGuard, isVipOnlyCharacteristic } from '@/hooks/useRecipeAccessGuard';
import { cn } from '@/lib/utils';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';

const CATEGORY_FILTERS = [
  { label: 'Xaropes Artesanais', value: 'Xaropes Artesanais', icon: GlassWater },
  { label: 'Sem Álcool', value: 'Sem Álcool', icon: Droplets },
  { label: 'Drinks de Galera', value: 'Drinks de Galera', icon: Users },
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

const UserRecipes: React.FC = () => {
  // Seed persists across navigation within the session — only re-shuffles on full page refresh
  // so users can return to a recipe they had eyed without losing their place.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [isStuck, setIsStuck] = useState(false);
  const { display: typingPlaceholder, isFocused, setIsFocused } = useTypingPlaceholder(SEARCH_PLACEHOLDERS);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const stickyRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data: planData } = useUserPlan();
  const { isVip: hasFullRecipeAccess } = useRecipeAccessGuard();
  const isLockedForUser = planData ? !hasFullRecipeAccess : false;


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

        <div ref={stickyRef} className="sticky top-0 z-[60] -mx-4 px-4 pt-0 pb-2 -mt-1">
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
                const isLocked = isLockedForUser && isVipOnlyCharacteristic((recipe as any).characteristics);
                const target = isLocked ? '/clube' : `/app/receita/${(recipe as any).slug || recipe.id}`;
                return (
                  <Link key={recipe.id} to={target}>
                    <div className="group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative">
                      {recipe.cover_image_url ? (
                        <div className="aspect-video overflow-hidden rounded-2xl relative">
                          <img
                            src={recipe.cover_image_url}
                            alt={recipe.title}
                            className={cn(
                              'h-full w-full object-cover transition-transform duration-500 group-hover:scale-105',
                              isLocked && 'brightness-50 saturate-50'
                            )}
                            loading="lazy"
                          />
                          {isLocked && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                              <div className="rounded-full bg-purple-600/90 p-3 shadow-lg shadow-purple-500/50">
                                <Lock className="h-5 w-5 text-white" />
                              </div>
                              <span className="rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
                                Exclusivo do Clube
                              </span>
                            </div>
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
    </div>
  );
};

export default UserRecipes;
