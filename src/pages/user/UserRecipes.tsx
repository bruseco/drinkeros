import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useExclusivePostsPaginated, refreshPostsSeed } from '@/hooks/useExclusivePosts';
import { Loader2, Search, Wine, GlassWater, Users, Citrus, CupSoda, Martini, IceCream, Snowflake } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/useDebounce';
import { refreshRecipeSeed } from '@/hooks/useUserRecipesPaginated';
import { cn } from '@/lib/utils';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';

const CATEGORY_FILTERS = [
  { label: 'Xaropes Artesanais', value: 'Xaropes Artesanais', icon: GlassWater },
  { label: 'Drinks de Galera', value: 'Drinks de Galera', icon: Users },
  { label: 'Caipirinhas', value: 'Caipirinha', icon: Citrus },
  { label: 'Batidas', value: 'Batida', icon: CupSoda },
  { label: 'Clássicos e Variações', value: 'Clássico', icon: Martini },
  { label: 'Sobremesas', value: 'Sobremesa', icon: IceCream },
  { label: 'Frozens', value: 'Frozen', icon: Snowflake },
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
  // Refresh seed on every mount so drinks appear in a new order
  useEffect(() => { refreshRecipeSeed(); refreshPostsSeed(); }, []);
  const [search, setSearch] = useState('');
  const [isStuck, setIsStuck] = useState(false);
  const { display: typingPlaceholder, isFocused, setIsFocused } = useTypingPlaceholder(SEARCH_PLACEHOLDERS);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const stickyRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);


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

        <div ref={stickyRef} className="sticky top-0 z-[60] -mx-4 px-4 py-2">
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
            <div className="flex flex-col gap-3">
              {recipes.map((recipe) => (
                <Link key={recipe.id} to={`/app/receita/${recipe.id}`}>
                  <div className="group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                    {recipe.cover_image_url ? (
                      <div className="aspect-video overflow-hidden rounded-2xl">
                        <img
                          src={recipe.cover_image_url}
                          alt={recipe.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-2xl bg-muted">
                        <Wine className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </Link>
              ))}
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
