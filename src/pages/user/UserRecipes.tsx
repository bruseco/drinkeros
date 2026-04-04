import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useExclusivePostsPaginated } from '@/hooks/useExclusivePosts';
import { Loader2, Wine, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';

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
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isFocused) return;

    let charIndex = 0;
    let deleting = false;
    let pauseTimeout: ReturnType<typeof setTimeout>;
    const current = () => texts[indexRef.current];

    const tick = () => {
      if (deleting) {
        charIndex--;
        setDisplay(current().slice(0, charIndex));
        if (charIndex === 0) {
          deleting = false;
          indexRef.current = (indexRef.current + 1) % texts.length;
          pauseTimeout = setTimeout(() => {
            rafRef.current = window.setTimeout(tick, typingSpeed);
          }, 300);
          return;
        }
        rafRef.current = window.setTimeout(tick, typingSpeed / 2);
      } else {
        charIndex++;
        setDisplay(current().slice(0, charIndex));
        if (charIndex === current().length) {
          deleting = true;
          pauseTimeout = setTimeout(() => {
            rafRef.current = window.setTimeout(tick, typingSpeed / 2);
          }, pauseMs);
          return;
        }
        rafRef.current = window.setTimeout(tick, typingSpeed);
      }
    };

    rafRef.current = window.setTimeout(tick, typingSpeed);
    return () => {
      if (rafRef.current) clearTimeout(rafRef.current);
      clearTimeout(pauseTimeout);
    };
  }, [isFocused, texts, typingSpeed, pauseMs]);

  return { display, isFocused, setIsFocused };
};

const UserRecipes: React.FC = () => {
  const [search, setSearch] = useState('');
  const { display: typingPlaceholder, isFocused, setIsFocused } = useTypingPlaceholder(SEARCH_PLACEHOLDERS);
  const debouncedSearch = useDebounce(search, 300);
  const [isSticky, setIsSticky] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '-64px 0px 0px 0px' } // 64px = navbar height
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
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
  });

  const recipes = data?.pages.flatMap((p) => p.posts) ?? [];

  const searchInput = (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isFocused && !search ? 'Buscar...' : typingPlaceholder}
        className="pl-9 rounded-full"
      />
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 pb-24 space-y-4">
      {/* Sentinel element to detect scroll position */}
      <div ref={sentinelRef} className="h-0 w-full" />

      {/* Sticky search bar with logo */}
      <div
        className={`transition-all duration-300 ${
          isSticky
            ? 'fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b shadow-sm px-4 py-2'
            : ''
        }`}
      >
        <div className={`${isSticky ? 'container mx-auto flex items-center gap-3' : ''}`}>
          {isSticky && (
            <Link to="/app" className="shrink-0">
              <img src={drinkrosLogo} alt="Drinkeros" className="h-7 object-contain" />
            </Link>
          )}
          {searchInput}
        </div>
      </div>

      {/* Spacer when sticky to prevent content jump */}
      {isSticky && <div className="h-12" />}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-muted p-12 text-center">
          <Wine className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {debouncedSearch ? 'Nenhuma receita encontrada' : 'Nenhuma receita disponível no momento'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {recipes.map((recipe) => (
              <Link key={recipe.id} to={`/app/receita/${recipe.id}`}>
                <div className="group overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  {recipe.cover_image_url ? (
                    <div className="aspect-video overflow-hidden rounded-2xl">
                      <img
                        src={recipe.cover_image_url}
                        alt={recipe.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted flex items-center justify-center rounded-2xl">
                      <Wine className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-full"
              >
                {isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserRecipes;
