import React, { useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useUserRecipesByPackage } from '@/hooks/useUserData';
import { useInfiniteRecipes } from '@/hooks/useUserRecipesPaginated';
import { usePackage } from '@/hooks/usePackages';
import { useLockedModuleLessons } from '@/hooks/useLockedContent';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { LessonCard, LessonCardSkeleton } from '@/components/user/LessonCard';
import { ArrowLeft, Search, Loader2, Lock, ShoppingCart } from 'lucide-react';
import defaultCover from '@/assets/default-cover.png';

const PAGE_SIZE = 20;

const UserModuleLessons: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [searchParams] = useSearchParams();
  const isLockedParam = searchParams.get('locked') === 'true';
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data: recipesByPackage, isLoading: sectionsLoading } = useUserRecipesByPackage();
  const packageSections = recipesByPackage?.sections ?? [];

  // Find module in user's enrolled modules
  const moduleInfo = useMemo(() => {
    return packageSections.find(section => section.package.id === moduleId);
  }, [packageSections, moduleId]);

  // Determine if locked: either via param or user doesn't have access
  const isLocked = isLockedParam || (!sectionsLoading && !moduleInfo);

  // Fetch package info for locked modules
  const { data: packageData } = usePackage(isLocked && moduleId ? moduleId : '');

  // Fetch public lesson metadata for locked modules
  const { data: lockedLessons = [], isLoading: lockedLessonsLoading } = useLockedModuleLessons(
    isLocked ? moduleId || null : null
  );

  // Infinite scroll for enrolled lessons
  const {
    data: infiniteData,
    isLoading: lessonsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteRecipes({
    packageId: moduleId || null,
    search: debouncedSearch,
    pageSize: PAGE_SIZE,
    enabled: !!moduleId && !isLocked,
  });

  const lessons = useMemo(() => {
    return infiniteData?.pages.flatMap(page => page.recipes) || [];
  }, [infiniteData]);

  const totalLessons = infiniteData?.pages[0]?.total || 0;

  const moduleName = moduleInfo?.package.name || packageData?.name || '';
  const checkoutUrl = packageData?.hotmart_product_code || '';

  const handleCheckout = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
    }
  };

  if (sectionsLoading || (isLocked && lockedLessonsLoading)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <LessonCardSkeleton key={i} compact />
          ))}
        </div>
      </div>
    );
  }

  // For locked mode without package data
  if (isLocked && !packageData && !moduleInfo) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Módulo não encontrado</p>
          <Link to="/app">
            <Button variant="link" className="mt-2">
              Voltar ao início
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // LOCKED MODE
  if (isLocked) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Checkout CTA Banner */}
        {checkoutUrl && (
          <div className="rounded-2xl bg-gradient-to-r from-primary to-accent p-4 flex items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3 text-primary-foreground">
              <Lock className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Desbloqueie este módulo</p>
                <p className="text-xs opacity-90">Tenha acesso completo a todas as aulas</p>
              </div>
            </div>
            <Button
              onClick={handleCheckout}
              size="sm"
              className="bg-white text-primary hover:bg-white/90 font-semibold gap-1.5 flex-shrink-0"
            >
              <ShoppingCart className="h-4 w-4" />
              Matricule-se
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/app">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{moduleName}</h1>
            <p className="text-sm text-muted-foreground">
              {lockedLessons.length} {lockedLessons.length === 1 ? 'aula' : 'aulas'}
            </p>
          </div>
        </div>

        {/* Locked Lessons Grid */}
        {lockedLessons.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Este módulo não tem aulas</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {lockedLessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={handleCheckout}
                className="cursor-pointer"
              >
                <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    <img
                      src={lesson.image_url || defaultCover}
                      alt={lesson.name}
                      className="h-full w-full object-contain opacity-50 grayscale-[30%]"
                    />
                    {/* Lock overlay */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 border border-white/20">
                        <Lock className="h-5 w-5 text-white/80" />
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-3 min-h-[3.5rem]">
                    <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">
                      {lesson.name}
                    </h3>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ENROLLED MODE (original behavior)
  if (!moduleInfo) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Módulo não encontrado</p>
          <Link to="/app">
            <Button variant="link" className="mt-2">
              Voltar ao início
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/app">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{moduleInfo.package.name}</h1>
          <p className="text-sm text-muted-foreground">
            {totalLessons} {totalLessons === 1 ? 'aula' : 'aulas'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar neste módulo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-12 h-12 rounded-2xl border-2 border-transparent bg-muted/50 focus:border-primary/30 focus:bg-card transition-all"
        />
      </div>

      {/* Lessons Grid */}
      {lessonsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <LessonCardSkeleton key={i} compact />
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {debouncedSearch ? 'Nenhuma aula encontrada' : 'Este módulo não tem aulas'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} compact />
            ))}
          </div>

          {/* Load More Button */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-full px-8"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  'Carregar mais aulas'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserModuleLessons;
