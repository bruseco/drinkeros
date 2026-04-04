import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useExclusivePostsPaginated } from '@/hooks/useExclusivePosts';
import { Loader2, Search, Wine } from 'lucide-react';
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
  const [search, setSearch] = useState('');
  const { display: typingPlaceholder, isFocused, setIsFocused } = useTypingPlaceholder(SEARCH_PLACEHOLDERS);
  const debouncedSearch = useDebounce(search, 300);

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

  const recipes = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <div className="space-y-5">
        <div className="sticky top-0 z-[60] -mx-4 px-4 py-2">
          <div className="mx-auto flex items-center gap-3 rounded-full border border-border/60 bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Link to="/app" className="shrink-0" aria-label="Ir para a página inicial do app">
              <img src={drinkrosLogo} alt="Drinkeros" className="h-7 w-auto object-contain" />
            </Link>

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
    </div>
  );
};

export default UserRecipes;
