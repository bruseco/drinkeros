import React from 'react';
import defaultCover from '@/assets/default-cover.png';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useCourse, useCoursePackages } from '@/hooks/useCourses';
import { useModuleProgress } from '@/hooks/useModuleProgress';
import { useUserRecipesByPackage } from '@/hooks/useUserData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BookOpen, GraduationCap, Lock, Play, ChevronRight, ShoppingCart } from 'lucide-react';

const UserCourseModules: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const isLockedParam = searchParams.get('locked') === 'true';

  const { data: course, isLoading: courseLoading } = useCourse(courseId || '');
  const { data: coursePackages = [], isLoading: packagesLoading } = useCoursePackages(courseId || '');

  // Get progress data
  const { data: recipesByPackage } = useUserRecipesByPackage();
  const sections = recipesByPackage?.sections ?? [];
  const viewedIds = recipesByPackage?.viewedIds ?? new Set<string>();
  const { getModuleProgress } = useModuleProgress(sections, viewedIds);

  // Check if user has access to any module of this course
  const userModuleIds = new Set(sections.map(s => s.package.id));
  const hasAccess = !isLockedParam && coursePackages.some(cp => cp.package && userModuleIds.has(cp.package.id));
  const isLocked = isLockedParam || (!courseLoading && !packagesLoading && !hasAccess);

  const checkoutUrl = course?.hotmart_product_code || '';
  const isLoading = courseLoading || packagesLoading;

  const handleCheckout = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Curso não encontrado</p>
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
      {/* Checkout CTA Banner for locked courses */}
      {isLocked && checkoutUrl && (
        <div className="rounded-2xl bg-gradient-to-r from-primary to-accent p-4 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3 text-primary-foreground">
            <Lock className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Desbloqueie este curso</p>
              <p className="text-xs opacity-90">Tenha acesso completo a todos os módulos</p>
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
          <h1 className="text-xl font-bold text-foreground">{course.name}</h1>
          <p className="text-sm text-muted-foreground">
            {coursePackages.length} {coursePackages.length === 1 ? 'módulo' : 'módulos'}
          </p>
        </div>
      </div>

      {/* Course cover */}
      <div className="relative overflow-hidden rounded-2xl aspect-[21/9]">
        <img
          src={course.cover_image_url || defaultCover}
          alt={course.name}
          className={`w-full h-full object-cover ${isLocked ? 'opacity-60 grayscale-[20%]' : ''}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 border border-white/20">
              <Lock className="h-8 w-8 text-white/80" />
            </div>
          </div>
        )}
        <div className="absolute bottom-4 left-4 right-4">
          <h2 className="text-white text-2xl font-bold drop-shadow-lg">{course.name}</h2>
          {course.description && (
            <p className="text-white/80 text-sm mt-1 line-clamp-2">{course.description}</p>
          )}
        </div>
      </div>

      {/* Modules Grid */}
      {coursePackages.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-muted p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <GraduationCap className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">
            Este curso ainda não tem módulos
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {coursePackages.map((cp) => {
            const pkg = cp.package;
            if (!pkg) return null;

            if (isLocked) {
              // Locked module card
              return (
                <div
                  key={cp.id}
                  onClick={handleCheckout}
                  className="cursor-pointer"
                >
                  <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 aspect-video relative">
                    <img
                      src={pkg.cover_image_url || defaultCover}
                      alt={pkg.name}
                      className="absolute inset-0 h-full w-full object-cover opacity-50 grayscale-[30%]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                    
                    {/* Lock icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 border border-white/20">
                        <Lock className="h-6 w-6 text-white/80" />
                      </div>
                    </div>

                    <div className="relative h-full flex flex-col justify-between p-4">
                      <div className="flex justify-end">
                        <Badge variant="secondary" className="bg-muted/60 text-muted-foreground border-0 shadow-md text-xs gap-1">
                          <Lock className="h-3 w-3" />
                          Bloqueado
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-semibold text-white text-base line-clamp-2 drop-shadow-md">
                          {pkg.name}
                        </h3>
                        <div className="flex items-center gap-1 text-white/80 text-xs">
                          <span>Desbloquear</span>
                          <ChevronRight className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            }

            // Enrolled module card (original)
            const progress = getModuleProgress(pkg.id);
            const isCompleted = progress === 100;

            return (
              <Link key={cp.id} to={`/app/modulo/${pkg.id}`}>
                <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 aspect-video relative">
                  <img
                    src={pkg.cover_image_url || defaultCover}
                    alt={pkg.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 shadow-lg">
                      <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
                    </div>
                  </div>
                  <div className="relative h-full flex flex-col justify-between p-4">
                    <div className="flex justify-end">
                      {isCompleted ? (
                        <Badge className="bg-success text-success-foreground border-0 shadow-md text-xs">
                          ✓ Concluído
                        </Badge>
                      ) : progress > 0 ? (
                        <Badge variant="secondary" className="shadow-md text-xs">
                          {progress}%
                        </Badge>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-white text-base line-clamp-2 drop-shadow-md">
                        {pkg.name}
                      </h3>
                      {progress > 0 && !isCompleted && (
                        <Progress value={progress} className="h-1" />
                      )}
                      <div className="flex items-center gap-1 text-white/80 text-xs">
                        <span>Ver aulas</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserCourseModules;
