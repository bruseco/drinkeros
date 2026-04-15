import React, { useState, useEffect } from 'react';
import defaultCover from '@/assets/default-cover.png';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useCourse, useCoursePackages } from '@/hooks/useCourses';
import { useModuleProgress } from '@/hooks/useModuleProgress';
import { useUserRecipesByPackage } from '@/hooks/useUserData';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Lock, ShoppingCart, ChevronDown, CheckCircle2, PlayCircle, Award } from 'lucide-react';
import CertificateDownloadButton from '@/components/user/CertificateDownloadButton';
import CourseCompletionCelebration from '@/components/user/CourseCompletionCelebration';

const UserCourseModules: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isLockedParam = searchParams.get('locked') === 'true';

  const { data: course, isLoading: courseLoading } = useCourse(courseId || '');
  const { data: coursePackages = [], isLoading: packagesLoading } = useCoursePackages(courseId || '');

  const { data: recipesByPackage } = useUserRecipesByPackage();
  const sections = recipesByPackage?.sections ?? [];
  const viewedIds = recipesByPackage?.viewedIds ?? new Set<string>();
  const { getModuleProgress } = useModuleProgress(sections, viewedIds);

  // Check if ALL modules in this course are complete
  const allModulesComplete = coursePackages.length > 0 && coursePackages.every((cp) => {
    if (!cp.package) return false;
    return getModuleProgress(cp.package.id) === 100;
  });

  const courseHasCertificate = (course as any)?.certificate_enabled && (course as any)?.certificate_bg_url;

  // Celebration popup logic - show only when the course transitions from incomplete to complete
  const [showCelebration, setShowCelebration] = useState(false);
  const completionStorageKey = user?.id && courseId ? `course_completion_state_${user.id}_${courseId}` : null;

  useEffect(() => {
    if (isLoading || !completionStorageKey) return;

    const currentState = localStorage.getItem(completionStorageKey);

    if (allModulesComplete) {
      if (currentState === 'incomplete') {
        setShowCelebration(true);
      }

      localStorage.setItem(completionStorageKey, 'complete');
      return;
    }

    localStorage.setItem(completionStorageKey, 'incomplete');
  }, [allModulesComplete, completionStorageKey, isLoading]);

  const userModuleIds = new Set(sections.map(s => s.package.id));
  const hasAccess = !isLockedParam && coursePackages.some(cp => cp.package && userModuleIds.has(cp.package.id));
  const isLocked = isLockedParam || (!courseLoading && !packagesLoading && !hasAccess);

  const checkoutUrl = course?.hotmart_product_code || '';
  const isLoading = courseLoading || packagesLoading;

  const handleCheckout = () => {
    if (checkoutUrl) window.open(checkoutUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-4">
        <Skeleton className="aspect-video rounded-2xl w-full" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-6 text-center py-12">
        <p className="text-muted-foreground">Curso não encontrado</p>
        <Link to="/app"><Button variant="link" className="mt-2">Voltar ao início</Button></Link>
      </div>
    );
  }

  // Find lessons for each module from sections data
  const getModuleLessons = (packageId: string) => {
    const section = sections.find(s => s.package.id === packageId);
    return section?.recipes ?? [];
  };

  return (
    <div className="container mx-auto px-4 py-6 pb-24 space-y-4">
      {/* Celebration popup */}
      {course && (
        <CourseCompletionCelebration
          open={showCelebration}
          onClose={() => setShowCelebration(false)}
          courseId={course.id}
          courseName={course.name}
          certificateBgUrl={(course as any).certificate_bg_url}
          hasCertificate={courseHasCertificate}
        />
      )}

      {/* Checkout CTA for locked courses */}
      {isLocked && checkoutUrl && (
        <div className="rounded-2xl bg-gradient-to-r from-primary to-accent p-4 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3 text-primary-foreground">
            <Lock className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Desbloqueie este curso</p>
              <p className="text-xs opacity-90">Acesso completo a todos os módulos</p>
            </div>
          </div>
          <Button onClick={handleCheckout} size="sm" className="bg-white text-primary hover:bg-white/90 font-semibold gap-1.5 flex-shrink-0">
            <ShoppingCart className="h-4 w-4" />
            Matricule-se
          </Button>
        </div>
      )}

      {/* Course cover - full width */}
      <div className="relative rounded-2xl">
        <img
          src={course.cover_image_url || defaultCover}
          alt={course.name}
          className={`w-full h-auto rounded-2xl ${isLocked ? 'opacity-60 grayscale-[20%]' : ''}`}
        />
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 border border-white/20">
              <Lock className="h-8 w-8 text-white/80" />
            </div>
          </div>
        )}
      </div>

      {/* Course title */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{course.name}</h1>
        {course.description && (
          <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {coursePackages.length} {coursePackages.length === 1 ? 'módulo' : 'módulos'}
        </p>
      </div>

      {/* Certificate Banner - ABOVE modules */}
      {allModulesComplete && (
        <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {courseHasCertificate ? 'Certificado disponível! 🎉' : 'Parabéns! 🎉'}
              </p>
              <p className="text-sm text-muted-foreground">
                {courseHasCertificate
                  ? 'Você concluiu todas as aulas deste curso'
                  : 'Você concluiu todas as aulas deste curso.'}
              </p>
            </div>
          </div>
          {courseHasCertificate && (
            <CertificateDownloadButton
              referenceId={course.id}
              referenceName={course.name}
              certificateBgUrl={(course as any).certificate_bg_url}
            />
          )}
        </div>
      )}

      {/* Modules as collapsible dropdowns */}
      <div className="space-y-2">
        {coursePackages.map((cp) => {
          const pkg = cp.package;
          if (!pkg) return null;

          const lessons = getModuleLessons(pkg.id);
          const progress = getModuleProgress(pkg.id);
          const isModuleComplete = progress === 100 && lessons.length > 0;

          return (
            <Collapsible key={cp.id}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl bg-card border border-border p-4 hover:bg-muted/50 transition-colors group">
                <div className="flex items-center gap-3 text-left">
                  {isModuleComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                  ) : isLocked ? (
                    <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <PlayCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                  <div>
                    <span className="font-medium text-sm text-foreground">{pkg.name}</span>
                    {!isLocked && lessons.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {lessons.filter(l => viewedIds.has(l.id)).length}/{lessons.length} aulas
                      </p>
                    )}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-1">
                <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {isLocked ? (
                    <div className="p-4 text-center" onClick={handleCheckout}>
                      <p className="text-sm text-muted-foreground">Desbloqueie para ver as aulas</p>
                    </div>
                  ) : lessons.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Nenhuma aula neste módulo</p>
                    </div>
                  ) : (
                    lessons.map((lesson) => {
                      const isCompleted = viewedIds.has(lesson.id);
                      return (
                        <Link
                          key={lesson.id}
                          to={`/app/aula/${lesson.id}`}
                          className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                        >
                          {/* Thumbnail */}
                          <div className="w-16 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                            <img
                              src={lesson.image_url || defaultCover}
                              alt={lesson.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          {/* Title */}
                          <span className={`flex-1 text-sm ${isCompleted ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {lesson.name}
                          </span>
                          {/* Check */}
                          {isCompleted && (
                            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                          )}
                        </Link>
                      );
                    })
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
};

export default UserCourseModules;
