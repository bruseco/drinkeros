import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import { LessonCard, LessonCardSkeleton } from '@/components/user/LessonCard';

export interface LessonCarouselProps {
  moduleId: string;
  moduleName: string;
  lessons: Array<{
    id: string;
    name: string;
    image_url: string | null;
    servings: string | null;
  }>;
  isLoading?: boolean;
  badge?: string;
}

export const LessonCarousel: React.FC<LessonCarouselProps> = ({
  moduleId,
  moduleName,
  lessons,
  isLoading = false,
  badge,
}) => {
  const displayLessons = lessons.slice(0, 12);

  return (
    <section className="space-y-4">
      {/* Header - only show if moduleName is provided */}
      {moduleName && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg text-foreground">{moduleName}</h2>
            {badge && (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-xs">
                {badge}
              </Badge>
            )}
          </div>
          <Link to={`/app/modulo/${moduleId}`}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1">
              Ver todo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* Carousel */}
      <div className="relative -mx-4 px-4 overflow-visible">
        <Carousel
          opts={{
            align: 'start',
            dragFree: true,
            containScroll: 'trimSnaps',
          }}
          className="w-full overflow-visible"
        >
          <CarouselContent className="-ml-2 md:-ml-3 overflow-visible">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <CarouselItem
                    key={i}
                    className="pl-2 md:pl-3 basis-[65%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
                  >
                    <LessonCardSkeleton compact />
                  </CarouselItem>
                ))
              : displayLessons.map((lesson) => (
                  <CarouselItem
                    key={lesson.id}
                    className="pl-2 md:pl-3 basis-[65%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
                  >
                    <LessonCard lesson={lesson} compact />
                  </CarouselItem>
                ))}
          </CarouselContent>

          {/* Navigation arrows - only on desktop */}
          <CarouselPrevious className="hidden md:flex -left-3 h-10 w-10 border-0 bg-background/90 shadow-lg backdrop-blur-sm hover:bg-background" />
          <CarouselNext className="hidden md:flex -right-3 h-10 w-10 border-0 bg-background/90 shadow-lg backdrop-blur-sm hover:bg-background" />
        </Carousel>
      </div>
    </section>
  );
};

export const LessonCarouselSkeleton: React.FC = () => {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="h-6 w-40 bg-muted rounded animate-pulse" />
        <div className="h-8 w-20 bg-muted rounded animate-pulse" />
      </div>
      <div className="flex gap-2 md:gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[65%] sm:w-1/2 md:w-1/3 lg:w-1/4">
            <LessonCardSkeleton compact />
          </div>
        ))}
      </div>
    </section>
  );
};
