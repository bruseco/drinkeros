import React from 'react';
import defaultCover from '@/assets/default-cover.png';
import { Link } from 'react-router-dom';
import { useUserCourses, useCourses } from '@/hooks/useCourses';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, BookOpen, ChevronRight, Play, Lock } from 'lucide-react';

const UserCourses: React.FC = () => {
  const { data: userCourses = [], isLoading: userLoading } = useUserCourses();
  const { data: allCourses = [], isLoading: coursesLoading } = useCourses(true);
  const { getCourseProgress } = useCourseProgress();

  const isLoading = userLoading || coursesLoading;
  const userCourseIds = new Set(userCourses.map((uc) => uc.course_id));

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

      {allCourses.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-muted p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Nenhum curso disponível</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1">
          {allCourses.map((course) => {
            const owned = userCourseIds.has(course.id) || course.is_free;
            return (
              <CourseCard key={course.id} course={course} owned={owned} getCourseProgress={getCourseProgress} />
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
    description: string | null;
    cover_image_url: string | null;
    hotmart_product_code: string | null;
  };
  owned: boolean;
  getCourseProgress: (courseId: string) => { progress: number; nextLessonId: string | null };
}

const CourseCard: React.FC<CourseCardProps> = ({ course, owned, getCourseProgress }) => {
  const { progress, nextLessonId } = owned ? getCourseProgress(course.id) : { progress: 0, nextLessonId: null };
  const hasStarted = owned && progress > 0;

  const cardLink = owned
    ? `/app/curso/${course.id}`
    : `/app/curso/${course.id}?locked=true`;

  return (
    <Link to={cardLink}>
      <div className="group rounded-2xl shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative">
        <img
          src={course.cover_image_url || defaultCover}
          alt={course.name}
          className={`w-full h-auto rounded-2xl transition-transform duration-500 ${
            !owned ? 'opacity-50 grayscale-[30%]' : ''
          }`}
        />

        {/* Badge */}
        <div className="absolute top-3 right-3 z-20">
          {owned ? (
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
            <div className="flex items-center gap-1 text-white/90 text-xs">
              <span>{owned ? 'Ver módulos' : 'Saiba mais'}</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default UserCourses;
