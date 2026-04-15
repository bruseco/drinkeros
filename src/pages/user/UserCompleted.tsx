import React from 'react';
import { useUserRecipesByPackage } from '@/hooks/useUserData';
import { useModuleProgress } from '@/hooks/useModuleProgress';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trophy } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LessonCarousel } from '@/components/user/LessonCarousel';
import CertificateDownloadButton from '@/components/user/CertificateDownloadButton';

/* ── Types ── */

interface CourseProgress {
  id: string;
  name: string;
  completed: boolean;
  packageIds: string[];
  certificate_enabled: boolean;
  certificate_bg_url: string | null;
  certificate_text_color: string | null;
}

interface ComboProgress {
  id: string;
  name: string;
  completed: boolean;
  courseIds: string[];
}

/* ── Course / Combo completion hooks ── */

const useCourseCompletion = (completedModuleIds: Set<string>) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['course-completion', user?.id, [...completedModuleIds].sort().join(',')],
    queryFn: async (): Promise<CourseProgress[]> => {
      if (!user || completedModuleIds.size === 0) return [];

      const { data: userCourses } = await supabase
        .from('user_courses')
        .select('course_id')
        .eq('user_id', user.id);

      if (!userCourses?.length) return [];

      const courseIds = userCourses.map((uc) => uc.course_id);

      const { data: courses } = await supabase
        .from('courses')
        .select('id, name, certificate_enabled, certificate_bg_url, certificate_text_color')
        .in('id', courseIds);

      const { data: coursePackages } = await supabase
        .from('course_packages')
        .select('course_id, package_id')
        .in('course_id', courseIds);

      if (!courses || !coursePackages) return [];

      return courses.map((course) => {
        const pkgIds = coursePackages
          .filter((cp) => cp.course_id === course.id)
          .map((cp) => cp.package_id);
        const completed = pkgIds.length > 0 && pkgIds.every((id) => completedModuleIds.has(id));
        return {
          id: course.id,
          name: course.name,
          completed,
          packageIds: pkgIds,
          certificate_enabled: (course as any).certificate_enabled ?? false,
          certificate_bg_url: (course as any).certificate_bg_url ?? null,
          certificate_text_color: (course as any).certificate_text_color ?? null,
        };
      });
    },
    enabled: !!user && completedModuleIds.size > 0,
  });
};

const useComboCompletion = (completedCourseIds: Set<string>) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['combo-completion', user?.id, [...completedCourseIds].sort().join(',')],
    queryFn: async (): Promise<ComboProgress[]> => {
      if (!user || completedCourseIds.size === 0) return [];

      const { data: userCombos } = await supabase
        .from('user_combos')
        .select('combo_id')
        .eq('user_id', user.id);

      if (!userCombos?.length) return [];

      const comboIds = userCombos.map((uc) => uc.combo_id);

      const { data: combos } = await supabase
        .from('combos')
        .select('id, name')
        .in('id', comboIds);

      const { data: comboCourses } = await supabase
        .from('combo_courses')
        .select('combo_id, course_id')
        .in('combo_id', comboIds);

      if (!combos || !comboCourses) return [];

      return combos.map((combo) => {
        const cIds = comboCourses
          .filter((cc) => cc.combo_id === combo.id)
          .map((cc) => cc.course_id);
        const completed = cIds.length > 0 && cIds.every((id) => completedCourseIds.has(id));
        return { id: combo.id, name: combo.name, completed, courseIds: cIds };
      });
    },
    enabled: !!user && completedCourseIds.size > 0,
  });
};

/* ── Empty state ── */

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-3xl border-2 border-dashed border-muted p-12 text-center">
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
      <Trophy className="h-8 w-8 text-muted-foreground" />
    </div>
    <p className="text-muted-foreground font-medium">Nenhum {label} concluído ainda</p>
    <p className="text-sm text-muted-foreground mt-1">
      Complete todo o conteúdo para vê-lo aqui
    </p>
  </div>
);

/* ── Main Page ── */

const UserCompleted: React.FC = () => {
  const { data, isLoading } = useUserRecipesByPackage();
  const sections = data?.sections ?? [];
  const viewedIds = data?.viewedIds ?? new Set<string>();

  const { completedModules } = useModuleProgress(sections, viewedIds);
  const completedModuleIds = new Set(completedModules.map((m) => m.package.id));

  const { data: courseProgress } = useCourseCompletion(completedModuleIds);
  const completedCourses = (courseProgress ?? []).filter((c) => c.completed);
  const completedCourseIds = new Set(completedCourses.map((c) => c.id));

  const { data: comboProgress } = useComboCompletion(completedCourseIds);
  const completedCombos = (comboProgress ?? []).filter((c) => c.completed);

  const totalCompleted = completedModules.length + completedCourses.length + completedCombos.length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/5 to-secondary p-6">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Trophy className="h-5 w-5" />
            <span className="text-sm font-medium">Parabéns!</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Concluídos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalCompleted === 0
              ? 'Você ainda não concluiu nenhum conteúdo. Continue estudando!'
              : `Você já concluiu ${totalCompleted} ${totalCompleted === 1 ? 'item' : 'itens'}!`}
          </p>
        </div>
      </section>

      {/* Tabs */}
      <Tabs defaultValue="modules">
        <TabsList className="w-full">
          <TabsTrigger value="modules" className="flex-1">
            Módulos ({completedModules.length})
          </TabsTrigger>
          <TabsTrigger value="courses" className="flex-1">
            Cursos ({completedCourses.length})
          </TabsTrigger>
          <TabsTrigger value="combos" className="flex-1">
            Combos ({completedCombos.length})
          </TabsTrigger>
        </TabsList>

        {/* Modules */}
        <TabsContent value="modules">
          {completedModules.length === 0 ? (
            <EmptyState label="módulo" />
          ) : (
            <div className="space-y-10 md:space-y-12">
              {completedModules.map((section) => (
                <div key={section.package.id}>
                  <LessonCarousel
                    moduleId={section.package.id}
                    moduleName={section.package.name}
                    lessons={section.recipes}
                    badge="✓ Concluído"
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Courses */}
        <TabsContent value="courses">
          {completedCourses.length === 0 ? (
            <EmptyState label="curso" />
          ) : (
            <div className="space-y-6">
              {completedCourses.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between rounded-2xl border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{course.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {course.packageIds.length}{' '}
                        {course.packageIds.length === 1 ? 'módulo' : 'módulos'}
                      </p>
                    </div>
                  </div>
                  {course.certificate_enabled && course.certificate_bg_url && (
                    <CertificateDownloadButton
                      referenceId={course.id}
                      referenceName={course.name}
                      certificateBgUrl={course.certificate_bg_url}
                      textColor={course.certificate_text_color || undefined}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Combos */}
        <TabsContent value="combos">
          {completedCombos.length === 0 ? (
            <EmptyState label="combo" />
          ) : (
            <div className="space-y-6">
              {completedCombos.map((combo) => (
                <div
                  key={combo.id}
                  className="flex items-center justify-between rounded-2xl border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{combo.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {combo.courseIds.length}{' '}
                        {combo.courseIds.length === 1 ? 'curso' : 'cursos'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserCompleted;
