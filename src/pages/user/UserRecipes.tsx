import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useExclusivePostsPaginated } from '@/hooks/useExclusivePosts';
import { Loader2, Wine, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';

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

  return (
    <div className="container mx-auto px-4 py-6 pb-24 space-y-4">
      {/* Search with typing effect */}
      <div className="relative">
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
