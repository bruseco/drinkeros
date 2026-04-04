import React from 'react';
import defaultCover from '@/assets/default-cover.png';
import { Link } from 'react-router-dom';
import { useUserCourses, useCourses } from '@/hooks/useCourses';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, ChevronRight, Play, Lock } from 'lucide-react';

const UserCourses: React.FC = () => {
  const { data: userCourses = [], isLoading: userLoading } = useUserCourses();
  const { data: allCourses = [], isLoading: coursesLoading } = useCourses(true);

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
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {allCourses.map((course) => {
            const owned = userCourseIds.has(course.id) || course.is_free;
            return (
              <CourseCard key={course.id} course={course} owned={owned} />
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
}

const CourseCard: React.FC<CourseCardProps> = ({ course, owned }) => {
  const linkTo = owned
    ? `/app/curso/${course.id}`
    : `/app/curso/${course.id}?locked=true`;

  return (
    <Link to={linkTo}>
      <div className="group overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative">
        <img
          src={course.cover_image_url || defaultCover}
          alt={course.name}
          className={`w-full object-contain transition-transform duration-500 group-hover:scale-105 ${
            !owned ? 'opacity-50 grayscale-[30%]' : ''
          }`}
        />

        {/* Badge */}
        <div className="absolute top-3 right-3">
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

        {/* Bottom label */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
          <div className="flex items-center gap-1 text-white/90 text-xs">
            <span>{owned ? 'Ver módulos' : 'Saiba mais'}</span>
            <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </Link>
  );
};

export default UserCourses;
