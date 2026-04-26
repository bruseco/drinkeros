import React, { useMemo } from 'react';
import { useViewportCenter } from '@/hooks/useViewportCenter';
import defaultCover from '@/assets/default-cover.png';
import { Link } from 'react-router-dom';
import { useUserCourses, useCourses } from '@/hooks/useCourses';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { useExpiredAccess } from '@/hooks/useExpiredAccess';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, BookOpen, ChevronRight, Play, Lock, Crown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const UserCourses: React.FC = () => {
  const { user } = useAuth();
  const { data: userCourses = [], isLoading: userLoading } = useUserCourses();
  const { data: allCourses = [], isLoading: coursesLoading } = useCourses(true);
  const { getCourseProgress } = useCourseProgress();
  const { data: expiredAccess } = useExpiredAccess();
  const expiredCourseIds = expiredAccess?.course_ids ?? new Set<string>();

  const userCourseIds = new Set(userCourses.map((uc) => uc.course_id));

  // Fetch last viewed timestamp per course for sorting
  const { data: lastViewedMap = new Map<string, string>() } = useQuery({
    queryKey: ['course-last-viewed', user?.id],
    queryFn: async () => {
      if (!user?.id) return new Map<string, string>();
      const { data, error } = await supabase
        .from('recipe_views')
        .select('recipe_id, viewed_at')
        .eq('user_id', user.id)
        .order('viewed_at', { ascending: false });
      if (error) throw error;

      // Map recipe_id -> viewed_at (most recent)
      const recipeViewedAt = new Map<string, string>();
      for (const rv of data || []) {
        if (!recipeViewedAt.has(rv.recipe_id)) {
          recipeViewedAt.set(rv.recipe_id, rv.viewed_at);
        }
      }
      return recipeViewedAt;
    },
    enabled: !!user?.id,
  });

  // Fetch all course_packages to map recipes to courses
  const courseIds = useMemo(() => allCourses.map(c => c.id), [allCourses]);
  const { data: allCoursePackages = [] } = useQuery({
    queryKey: ['all-course-packages-sort', courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return [];
      const { data, error } = await supabase
        .from('course_packages')
        .select('course_id, package_id')
        .in('course_id', courseIds);
      if (error) throw error;
      return data;
    },
    enabled: courseIds.length > 0,
  });

  const { data: allRecipePackages = [] } = useQuery({
    queryKey: ['all-recipe-packages-sort'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_packages')
        .select('recipe_id, package_id');
      if (error) throw error;
      return data;
    },
  });

  const sortedCourses = useMemo(() => {
    // Build course -> last viewed timestamp
    const packageToCourses = new Map<string, string[]>();
    for (const cp of allCoursePackages) {
      const list = packageToCourses.get(cp.package_id) || [];
      list.push(cp.course_id);
      packageToCourses.set(cp.package_id, list);
    }

    const courseLastViewed = new Map<string, string>();
    for (const rp of allRecipePackages) {
      const viewedAt = lastViewedMap.get(rp.recipe_id);
      if (!viewedAt) continue;
      const courses = packageToCourses.get(rp.package_id) || [];
      for (const courseId of courses) {
        const existing = courseLastViewed.get(courseId);
        if (!existing || viewedAt > existing) {
          courseLastViewed.set(courseId, viewedAt);
        }
      }
    }

    return [...allCourses].sort((a, b) => {
      const aOwned = userCourseIds.has(a.id) || a.is_free;
      const bOwned = userCourseIds.has(b.id) || b.is_free;

      // Owned first
      if (aOwned && !bOwned) return -1;
      if (!aOwned && bOwned) return 1;

      if (aOwned && bOwned) {
        const aLastView = courseLastViewed.get(a.id);
        const bLastView = courseLastViewed.get(b.id);

        // Started courses first, most recent on top
        if (aLastView && bLastView) return bLastView.localeCompare(aLastView);
        if (aLastView && !bLastView) return -1;
        if (!aLastView && bLastView) return 1;

        // Both not started: alphabetical
        return a.name.localeCompare(b.name);
      }

      // Both unowned: alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [allCourses, userCourseIds, lastViewedMap, allCoursePackages, allRecipePackages]);

  const isLoading = userLoading || coursesLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-foreground mb-2">Cursos</h1>
        <p className="text-muted-foreground">Explore todos os cursos disponíveis</p>
      </section>

      {sortedCourses.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-muted p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Nenhum curso disponível</p>
        </div>
      ) : (
        <div className="grid gap-8 grid-cols-1">
          {sortedCourses.map((course) => {
            const owned = userCourseIds.has(course.id) || course.is_free;
            const expired = expiredCourseIds.has(course.id);
            return (
              <CourseCard key={course.id} course={course} owned={owned} expired={expired} getCourseProgress={getCourseProgress} />
            );
          })}
        </div>
      )}
    </div>
  );
};
interface CourseCardProps {
  course: {
    id: string;
    name: string;
    slug?: string | null;
    description: string | null;
    cover_image_url: string | null;
    hotmart_product_code: string | null;
  };
  owned: boolean;
  expired?: boolean;
  getCourseProgress: (courseId: string) => { progress: number; nextLessonId: string | null };
}

// Slugs do DB que possuem landing page pública dedicada.
// Mapeia slug do curso → rota da landing.
const COURSE_LANDING_ROUTES: Record<string, string> = {
  'mixologia-avancada': '/mixologia-avancada',
  'bar-p-eventos': '/bar-p-eventos',
  'drinkdelivery-engarrafados': '/drinkdelivery-engarrafados',
  'producao-de-ingredientes-artesanais': '/ingredientes-artesanais',
  'drinkeros-xperience': '/drinkeros-xperience',
  'classicos-destilados': '/classicos-destilados',
  'workshop-alem-dos-classicos': '/workshop-alem-dos-classicos',
  'bartender-a-bordo': '/bartender-a-bordo',
  'bebida-decifrada': '/bebida-decifrada',
};

const CourseCard: React.FC<CourseCardProps> = ({ course, owned, expired = false, getCourseProgress }) => {
  const { progress, nextLessonId } = owned && !expired ? getCourseProgress(course.id) : { progress: 0, nextLessonId: null };
  const hasStarted = owned && !expired && progress > 0;
  const { ref, centrality } = useViewportCenter<HTMLDivElement>();

  // Expirado tem prioridade visual: leva pra /vip pra renovar
  // Bloqueado: leva pra landing/página de venda do curso (se houver)
  const landingRoute = course.slug ? COURSE_LANDING_ROUTES[course.slug] : undefined;
  const cardLink = expired
    ? '/vip'
    : owned
    ? `/app/curso/${course.id}`
    : landingRoute ?? `/app/curso/${course.id}?locked=true`;

  // Opacidade dinâmica: base 0.55 → 1.0 conforme se aproxima do centro
  const dynamicOpacity = expired ? 0.4 : 0.55 + 0.45 * centrality;
  // "Saiba mais" oscila horizontalmente proporcional à centralidade
  const wiggleX = Math.sin(Date.now() / 350) * 6 * centrality;

  return (
    <Link to={cardLink}>
      <div
        ref={ref}
        className="group rounded-2xl shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative"
      >
        <img
          src={course.cover_image_url || defaultCover}
          alt={course.name}
          style={{ opacity: dynamicOpacity, transition: 'opacity 200ms linear' }}
          className={`w-full h-auto rounded-2xl ${expired ? 'grayscale' : !owned ? 'grayscale-[30%]' : ''}`}
        />

        {/* Badge */}
        <div className="absolute top-3 right-3 z-20">
          {expired ? (
            <Badge className="bg-destructive text-destructive-foreground border-0 shadow-md text-xs gap-1">
              <Crown className="h-3 w-3" />
              Expirado · Renovar
            </Badge>
          ) : owned ? (
            <Badge className="bg-success text-success-foreground border-0 shadow-md text-xs">
              ✓ Adquirido
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-muted/60 text-muted-foreground border-0 shadow-md text-xs gap-1">
              <Lock className="h-3 w-3" />
              Bloqueado
            </Badge>
          )}
        </div>

        {/* Top label with progress */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-3 pb-8 z-10">
          {hasStarted && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-white text-xs mb-1">
                <span className="font-medium">{progress}% concluído</span>
              </div>
              <Progress value={progress} className="h-1.5 w-1/3 bg-white/20 [&>div]:bg-white" />
            </div>
          )}
          {hasStarted && nextLessonId ? (
            <Link
              to={`/app/aula/${nextLessonId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-white/90 text-xs hover:text-white transition-colors"
            >
              <span>Ir para próxima aula</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : (
            <div
              className="flex items-center gap-1 text-white/90 text-xs"
              style={{ transform: `translateX(${wiggleX}px)`, transition: 'transform 120ms linear' }}
            >
              <span>{expired ? 'Reativar com VIP' : owned ? 'Ver módulos' : 'Saiba mais'}</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default UserCourses;
