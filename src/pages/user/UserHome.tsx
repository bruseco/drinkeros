import React, { useState, useMemo, useEffect } from 'react';
import defaultCover from '@/assets/default-cover.png';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPackages, useUserRecipesByPackage } from '@/hooks/useUserData';
import { useUserRecipesPaginated, useInfiniteRecipes, usePrefetchNextPage } from '@/hooks/useUserRecipesPaginated';
import { usePackages } from '@/hooks/usePackages';
import { useCourses, useUserCourses } from '@/hooks/useCourses';
import { useCombos, useUserCombos } from '@/hooks/useCombos';
import { useRecentlyViewedRecipes } from '@/hooks/useRecipeViews';
import { useModuleProgress } from '@/hooks/useModuleProgress';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUpsellPlacement } from '@/hooks/useUpsellPlacement';
import { useUxTracking } from '@/hooks/useUxTracking';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Play, Sparkles, Clock, BookOpen, ChevronRight, Lock, CheckCircle2 } from 'lucide-react';
import { InstallBanner } from '@/components/user/InstallBanner';
import { Progress } from '@/components/ui/progress';
import { LessonGrid } from '@/components/user/LessonGrid';
import { LessonCarousel, LessonCarouselSkeleton } from '@/components/user/LessonCarousel';
import { UpsellSection } from '@/components/user/UpsellCardCompact';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from '@/components/ui/carousel';

const PAGE_SIZE_MOBILE = 20;
const PAGE_SIZE_DESKTOP = 24;

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

type CatalogItem = {
  type: 'combo' | 'course' | 'module';
  id: string;
  slug?: string | null;
  name: string;
  cover_image_url: string | null;
  enrolled: boolean;
  courseCount?: number;
  moduleCount?: number;
};

// Cursos disponíveis APENAS para Assinantes VIP — quando bloqueados,
// o "Saiba mais" leva direto para a página de assinatura VIP.
const VIP_ONLY_COURSE_SLUGS = new Set<string>([
  'bebida-decifrada',
  'workshop-alem-dos-classicos',
]);

const UserHome: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [catalogApi, setCatalogApi] = useState<CarouselApi>();
  
  const debouncedSearch = useDebounce(search, 300);
  const isMobile = useIsMobile();
  
  const { profile } = useAuth();
  const { data: userPackages = [], isLoading: packagesLoading } = useUserPackages();
  const { data: recipesByPackage, isLoading: sectionsLoading } = useUserRecipesByPackage();
  const packageSections = recipesByPackage?.sections ?? [];
  const completedRecipeIds = recipesByPackage?.viewedIds ?? new Set<string>();
  const { data: recentlyViewed = [], isLoading: recentlyViewedLoading } = useRecentlyViewedRecipes();
  const { data: allPackages = [] } = usePackages(true);
  const { data: allCourses = [] } = useCourses(true);
  const { data: userCourses = [] } = useUserCourses();
  const { data: allCombos = [] } = useCombos(true);
  const { data: userCombos = [] } = useUserCombos();
  const { prefetchNextPage } = usePrefetchNextPage();

  const { inProgressModules } = useModuleProgress(packageSections, completedRecipeIds);
  const { getCourseProgress } = useCourseProgress();

  const { position: upsellPosition } = useUpsellPlacement(inProgressModules.length);
  const { upsellRef, trackUpsellClick } = useUxTracking(upsellPosition, inProgressModules.length);

  const pageSize = isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;

  // Desktop: Paginated query (only when searching)
  const {
    data: paginatedData,
    isLoading: paginatedLoading,
  } = useUserRecipesPaginated({
    packageId: selectedPackageId,
    search: debouncedSearch,
    page: currentPage,
    pageSize,
    enabled: !!debouncedSearch,
  });

  // Mobile: Infinite scroll query (only when searching)
  const {
    data: infiniteData,
    isLoading: infiniteLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteRecipes({
    packageId: selectedPackageId,
    search: debouncedSearch,
    pageSize,
    enabled: isMobile && !!debouncedSearch,
  });

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(0);
  }, [selectedPackageId, debouncedSearch]);

  // Prefetch next page on hover (desktop)
  const handlePrefetchNext = () => {
    if (!isMobile && paginatedData) {
      const totalPages = Math.ceil(paginatedData.total / pageSize);
      prefetchNextPage({
        packageId: selectedPackageId,
        search: debouncedSearch,
        currentPage,
        pageSize,
        totalPages,
      });
    }
  };

  const userPackageIds = userPackages.map((up) => up.package_id);

  // Consolidated catalog: enrolled + not enrolled
  const consolidatedItems = useMemo(() => {
    // Build set of package IDs covered by user's courses
    const coveredPackageIds = new Set<string>();
    for (const uc of userCourses) {
      for (const m of uc.modules) {
        coveredPackageIds.add(m.id);
      }
    }

    // Build set of course IDs covered by user's combos
    const coveredCourseIds = new Set<string>();
    for (const ucb of userCombos) {
      for (const c of ucb.courses) {
        coveredCourseIds.add(c.id);
      }
    }

    const items: CatalogItem[] = [];
    const addedComboIds = new Set<string>();
    const addedCourseIds = new Set<string>();
    const addedModuleIds = new Set<string>();

    // === ENROLLED items first ===

    // Enrolled combos
    for (const ucb of userCombos) {
      items.push({
        type: 'combo',
        id: ucb.combo_id,
        name: ucb.combo.name,
        cover_image_url: ucb.combo.cover_image_url,
        enrolled: true,
        courseCount: ucb.courses.length,
      });
      addedComboIds.add(ucb.combo_id);
    }

    // Enrolled courses not covered by combos
    for (const uc of userCourses) {
      if (!coveredCourseIds.has(uc.course_id)) {
        items.push({
          type: 'course',
          id: uc.course_id,
          name: uc.course.name,
          cover_image_url: uc.course.cover_image_url,
          enrolled: true,
          moduleCount: uc.modules.length,
        });
        addedCourseIds.add(uc.course_id);
      }
    }

    // Enrolled standalone modules (not covered by any owned course)
    for (const section of packageSections) {
      if (!coveredPackageIds.has(section.package.id)) {
        items.push({
          type: 'module',
          id: section.package.id,
          name: section.package.name,
          cover_image_url: section.package.cover_image_url ?? null,
          enrolled: true,
        });
        addedModuleIds.add(section.package.id);
      }
    }

    // === NOT ENROLLED items ===

    // Not enrolled combos
    const userComboIds = userCombos.map((uc) => uc.combo_id);
    for (const combo of allCombos) {
      if (!addedComboIds.has(combo.id) && !userComboIds.includes(combo.id) && combo.is_available_for_sale) {
        items.push({
          type: 'combo',
          id: combo.id,
          name: combo.name,
          cover_image_url: combo.cover_image_url,
          enrolled: false,
        });
        addedComboIds.add(combo.id);
      }
    }

    // Not enrolled courses
    const userCourseIds = userCourses.map((uc) => uc.course_id);
    for (const course of allCourses) {
      if (!addedCourseIds.has(course.id) && !userCourseIds.includes(course.id) && course.is_available_for_sale) {
        items.push({
          type: 'course',
          id: course.id,
          slug: (course as any).slug ?? null,
          name: course.name,
          cover_image_url: course.cover_image_url,
          enrolled: false,
        });
        addedCourseIds.add(course.id);
      }
    }

    // Not enrolled modules (standalone, not part of enrolled courses)
    for (const pkg of allPackages) {
      if (!addedModuleIds.has(pkg.id) && !userPackageIds.includes(pkg.id) && !coveredPackageIds.has(pkg.id) && pkg.is_available_for_sale) {
        items.push({
          type: 'module',
          id: pkg.id,
          name: pkg.name,
          cover_image_url: pkg.cover_image_url,
          enrolled: false,
        });
        addedModuleIds.add(pkg.id);
      }
    }

    return items;
  }, [userCourses, userCombos, packageSections, allCombos, allCourses, allPackages, userPackageIds]);

  // Reset catalog scroll to start (enrolled items first)
  useEffect(() => {
    if (catalogApi) {
      catalogApi.scrollTo(0, true);
    }
  }, [consolidatedItems, catalogApi]);

  // Filter "Continuar Assistindo" to exclude lessons from completed modules
  const inProgressModuleIds = new Set(inProgressModules.map((m) => m.package.id));
  const filteredRecentlyViewed = useMemo(() => {
    if (!recentlyViewed.length || !packageSections.length) return recentlyViewed;
    const completedModuleRecipeIds = new Set<string>();
    for (const section of packageSections) {
      if (!inProgressModuleIds.has(section.package.id)) {
        for (const r of section.recipes) {
          completedModuleRecipeIds.add(r.id);
        }
      }
    }
    return recentlyViewed.filter((r) => !completedModuleRecipeIds.has(r.id));
  }, [recentlyViewed, packageSections, inProgressModuleIds]);

  const firstName = profile?.full_name?.split(' ')[0] || 'Aluno';

  // Get lessons for search mode
  const searchLessons = useMemo(() => {
    if (isMobile) {
      return infiniteData?.pages.flatMap(page => page.recipes) || [];
    }
    return paginatedData?.recipes || [];
  }, [isMobile, infiniteData, paginatedData]);

  const totalLessons = isMobile 
    ? (infiniteData?.pages[0]?.total || 0)
    : (paginatedData?.total || 0);

  const totalPages = Math.ceil(totalLessons / pageSize);

  const isSearchMode = !!debouncedSearch;
  const isSearchLoading = isMobile ? infiniteLoading : paginatedLoading;

  if (packagesLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Install Banner */}
      <InstallBanner />

      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/5 to-secondary p-6">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />
        
        <div className="relative">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">{getGreeting()}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {firstName}! 👋
          </h1>
        </div>
      </section>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar aulas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-12 h-12 rounded-2xl border-2 border-transparent bg-muted/50 focus:border-primary/30 focus:bg-card transition-all"
        />
      </div>

      {/* Content */}
      {isSearchMode ? (
        <>
          {totalLessons > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {totalLessons} {totalLessons === 1 ? 'resultado' : 'resultados'} para "{debouncedSearch}"
              </span>
              {!isMobile && totalPages > 1 && (
                <span onMouseEnter={handlePrefetchNext}>
                  Página {currentPage + 1} de {totalPages}
                </span>
              )}
            </div>
          )}
          <LessonGrid
            lessons={searchLessons}
            isLoading={isSearchLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            onLoadMore={() => fetchNextPage()}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            isMobile={isMobile}
            searchTerm={debouncedSearch}
            emptyMessage="Nenhuma aula encontrada"
          />
        </>
      ) : (
        <div className="space-y-10 md:space-y-12">
          {/* Consolidated Courses & Modules Catalog */}
          {consolidatedItems.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <BookOpen className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg text-foreground">Cursos e Módulos</h2>
              </div>
              <div className="relative -mx-4 px-4 overflow-visible">
                <Carousel
                  opts={{
                    align: 'start',
                    dragFree: true,
                    containScroll: 'trimSnaps',
                  }}
                  setApi={setCatalogApi}
                  className="w-full overflow-visible"
                >
                  <CarouselContent className="-ml-3">
                    {consolidatedItems.map((item) => {
                      const courseProgress = item.type === 'course' && item.enrolled ? getCourseProgress(item.id) : null;
                      const hasStarted = courseProgress && courseProgress.progress > 0;

                      const isVipOnlyLocked =
                        !item.enrolled &&
                        item.type === 'course' &&
                        item.slug &&
                        VIP_ONLY_COURSE_SLUGS.has(item.slug);

                      const linkTo = item.enrolled
                        ? (item.type === 'combo' ? `/app/combo/${item.id}` 
                          : item.type === 'course' 
                            ? (hasStarted && courseProgress.nextLessonId ? `/app/aula/${courseProgress.nextLessonId}` : `/app/curso/${item.id}`)
                            : `/app/modulo/${item.id}`)
                        : isVipOnlyLocked
                          ? '/clube'
                          : (item.type === 'combo' ? `/app/combo/${item.id}?locked=true` : item.type === 'course' ? `/app/curso/${item.id}?locked=true` : `/app/modulo/${item.id}?locked=true`);

                      return (
                        <CarouselItem
                          key={`${item.type}-${item.id}`}
                          className="pl-3 basis-[200px] sm:basis-[240px] md:basis-[280px]"
                        >
                          <Link to={linkTo}>
                            <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col">
                              <div className="relative aspect-video bg-black flex items-center justify-center">
                                <img
                                  src={item.cover_image_url || defaultCover}
                                  alt={item.name}
                                  className={`max-h-full max-w-full object-contain transition-all duration-300 ${!item.enrolled ? 'opacity-50 grayscale-[30%]' : ''}`}
                                />
                                {!item.enrolled && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 border border-white/20">
                                      <Lock className="h-5 w-5 text-white/80" />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="bg-black/90 p-3 flex flex-col gap-1.5">
                                {item.enrolled ? (
                                  <Badge className="bg-emerald-600 text-white border-0 shadow-md text-xs w-fit gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Matriculado
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-muted/60 text-muted-foreground border-0 shadow-md text-xs w-fit gap-1">
                                    <Lock className="h-3 w-3" />
                                    Disponível
                                  </Badge>
                                )}
                                <h3 className="font-semibold text-white text-sm line-clamp-2">
                                  {item.name}
                                </h3>
                                {hasStarted && (
                                  <div>
                                    <div className="flex items-center justify-between text-white/80 text-xs mb-1">
                                      <span>{courseProgress.progress}% concluído</span>
                                      {courseProgress.nextLessonId && (
                                        <span className="flex items-center gap-0.5">
                                          <Play className="h-2.5 w-2.5 fill-current" />
                                          Continuar
                                        </span>
                                      )}
                                    </div>
                                    <Progress value={courseProgress.progress} className="h-1 bg-white/20 [&>div]:bg-white" />
                                  </div>
                                )}
                                <div className="flex items-center gap-1 text-white/80 text-xs">
                                  <span>{item.enrolled 
                                    ? (item.type === 'combo' ? 'Ver cursos' : item.type === 'course' ? (hasStarted && courseProgress?.nextLessonId ? 'Próxima aula' : 'Ver módulos') : 'Ver aulas')
                                    : 'Saiba mais'
                                  }</span>
                                  <ChevronRight className="h-3 w-3" />
                                </div>
                              </div>
                            </Card>
                          </Link>
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>

                  {/* Navigation arrows - only on desktop */}
                  <CarouselPrevious className="hidden md:flex -left-3 h-10 w-10 border-0 bg-background/90 shadow-lg backdrop-blur-sm hover:bg-background" />
                  <CarouselNext className="hidden md:flex -right-3 h-10 w-10 border-0 bg-background/90 shadow-lg backdrop-blur-sm hover:bg-background" />
                </Carousel>
              </div>
            </section>
          )}

          {/* Recently Viewed Carousel */}
          {!recentlyViewedLoading && filteredRecentlyViewed.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg text-foreground">Continuar Assistindo</h2>
              </div>
              <LessonCarousel
                moduleId="recently-viewed"
                moduleName=""
                lessons={filteredRecentlyViewed}
              />
            </section>
          )}

          {sectionsLoading ? (
            <>
              <LessonCarouselSkeleton />
              <LessonCarouselSkeleton />
            </>
          ) : (
            (() => {
              // Build upsell element
              const upsellPackages = allPackages.filter(
                (p) => !userPackageIds.includes(p.id) && !p.is_free && p.is_available_for_sale && !!p.checkout_url
              );
              const upsellCourses = allCourses.filter(
                (c) => !userCourses.some(uc => uc.course_id === c.id) && !c.is_free && c.is_available_for_sale && !!c.checkout_url
              );
              const upsellCombos = allCombos.filter(
                (c) => !userCombos.some(uc => uc.combo_id === c.id) && !c.is_free && c.is_available_for_sale && !!c.checkout_url
              );
              const hasUpsell = upsellPackages.length > 0 || upsellCourses.length > 0 || upsellCombos.length > 0;

              const upsellElement = hasUpsell ? (
                <div ref={upsellRef} key="upsell-section" onClick={() => trackUpsellClick()}>
                  <UpsellSection packages={[
                    ...upsellCombos.map(c => ({
                      id: c.id,
                      name: c.name,
                      description: c.description,
                      cover_image_url: c.cover_image_url,
                      checkout_url: c.checkout_url,
                    })),
                    ...upsellCourses.map(c => ({
                      id: c.id,
                      name: c.name,
                      description: c.description,
                      cover_image_url: c.cover_image_url,
                      checkout_url: c.checkout_url,
                    })),
                    ...upsellPackages,
                  ]} />
                </div>
              ) : null;

              // Clamp position to valid range
              const clampedPosition = Math.max(1, Math.min(upsellPosition, inProgressModules.length));

              // Interleave upsell among carousels
              const elements: React.ReactNode[] = [];
              inProgressModules.forEach((section, index) => {
                if (index === clampedPosition && upsellElement) {
                  elements.push(upsellElement);
                }
                elements.push(
                  <LessonCarousel
                    key={section.package.id}
                    moduleId={section.package.id}
                    moduleName={section.package.name}
                    lessons={section.recipes}
                  />
                );
              });

              // If position is beyond modules or no modules, append upsell at end
              if (upsellElement && (clampedPosition >= inProgressModules.length || inProgressModules.length === 0)) {
                elements.push(upsellElement);
              }

              return elements;
            })()
          )}
        </div>
      )}
    </div>
  );
};

export default UserHome;
