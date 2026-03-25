import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Clock } from 'lucide-react';
import defaultCover from '@/assets/default-cover.png';

export interface LessonCardProps {
  lesson: {
    id: string;
    name: string;
    image_url: string | null;
    servings: string | null; // used as duration
  };
  compact?: boolean;
}

export const LessonCard: React.FC<LessonCardProps> = ({ lesson, compact = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <Link to={`/app/aula/${lesson.id}`}>
      <Card
        ref={cardRef}
        className="group overflow-hidden rounded-2xl border-0 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1"
      >
        <div className={`${compact ? 'aspect-video' : 'aspect-video'} bg-muted relative overflow-hidden`}>
          {isVisible ? (
            <>
              {!imageLoaded && (
                <Skeleton className="absolute inset-0 h-full w-full" />
              )}
              <img
                src={lesson.image_url || defaultCover}
                alt={lesson.name}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                className={`h-full w-full object-contain transition-all duration-500 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 shadow-lg">
                  <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
                </div>
              </div>
            </>
          ) : (
            <Skeleton className="h-full w-full" />
          )}
          {/* Duration badge */}
          {lesson.servings && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
              <Clock className="h-3 w-3" />
              <span>{lesson.servings}</span>
            </div>
          )}
        </div>
        <CardContent className={compact ? 'p-3 min-h-[3.5rem]' : 'p-4'}>
          <h3 className={`font-semibold text-foreground group-hover:text-primary transition-colors whitespace-normal break-words text-balance ${compact ? 'text-sm leading-tight line-clamp-2' : ''}`}>
            {lesson.name}
          </h3>
        </CardContent>
      </Card>
    </Link>
  );
};

export const LessonCardSkeleton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-md">
      <Skeleton className="aspect-video w-full" />
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <Skeleton className={`h-5 w-3/4 ${compact ? 'h-4' : ''}`} />
        {!compact && <Skeleton className="mt-2 h-4 w-1/4" />}
      </CardContent>
    </Card>
  );
};
