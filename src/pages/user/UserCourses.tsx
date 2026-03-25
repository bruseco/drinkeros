import React from 'react';
import defaultCover from '@/assets/default-cover.png';
import { Link } from 'react-router-dom';
import { useUserCourses } from '@/hooks/useCourses';
import { usePackages } from '@/hooks/usePackages';
import { useCourses } from '@/hooks/useCourses';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, BookOpen, ChevronRight, Play, Sparkles } from 'lucide-react';
import { UpsellCardCompact } from '@/components/user/UpsellCardCompact';

const UserCourses: React.FC = () => {
  const { data: userCourses = [], isLoading } = useUserCourses();
  const { data: allCourses = [] } = useCourses(true);

  const userCourseIds = userCourses.map((uc) => uc.course_id);
  const upsellCourses = allCourses.filter(
    (c) => !userCourseIds.includes(c.id) && !c.is_free && c.is_available_for_sale && !!c.hotmart_product_code
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-10">
      {/* Header */}
      <section>
        <h1 className="text-2xl font-bold text-foreground mb-2">Meus Cursos</h1>
        <p className="text-muted-foreground">Seus cursos e formações</p>
      </section>

      {/* User's courses */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-primary">📚</span>
          Cursos Adquiridos ({userCourses.length})
        </h2>
        {userCourses.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-muted p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">Você ainda não tem cursos</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {userCourses.map((uc) => (
              <CourseCard key={uc.id} course={uc} />
            ))}
          </div>
        )}
      </section>

      {/* Upsell courses */}
      {upsellCourses.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Descubra Mais
          </h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {upsellCourses.map((course) => (
              <UpsellCardCompact
                key={course.id}
                pkg={{
                  id: course.id,
                  name: course.name,
                  description: course.description,
                  cover_image_url: course.cover_image_url,
                  hotmart_product_code: course.hotmart_product_code,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

interface CourseCardProps {
  course: {
    course_id: string;
    course: {
      id: string;
      name: string;
      description: string | null;
      cover_image_url: string | null;
    };
    modules: Array<{
      id: string;
      name: string;
    }>;
  };
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  return (
    <Link to={`/app/curso/${course.course_id}`}>
      <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 aspect-video relative">
        <img
          src={course.course.cover_image_url || defaultCover}
          alt={course.course.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 shadow-lg">
            <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
          </div>
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col justify-between p-4">
          <div className="flex justify-between items-start">
            <Badge className="bg-primary/80 text-primary-foreground border-0 shadow-md text-xs">
              {course.modules.length} {course.modules.length === 1 ? 'módulo' : 'módulos'}
            </Badge>
            <Badge className="bg-success text-success-foreground border-0 shadow-md text-xs">
              ✓ Adquirido
            </Badge>
          </div>

          <div className="space-y-1">
            <h3 className="font-semibold text-white text-base line-clamp-2 drop-shadow-md">
              {course.course.name}
            </h3>
            <div className="flex items-center gap-1 text-white/80 text-xs">
              <span>Ver módulos</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default UserCourses;
