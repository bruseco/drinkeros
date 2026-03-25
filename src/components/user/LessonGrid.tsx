import React from 'react';
import { LessonCard, LessonCardSkeleton } from '@/components/user/LessonCard';
import { Button } from '@/components/ui/button';
import { Loader2, Play } from 'lucide-react';

interface LessonGridProps {
  lessons: Array<{
    id: string;
    name: string;
    image_url: string | null;
    servings: string | null;
  }>;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  isMobile?: boolean;
  searchTerm?: string;
  emptyMessage?: string;
}

export const LessonGrid: React.FC<LessonGridProps> = ({
  lessons,
  isLoading = false,
  isFetchingNextPage = false,
  hasNextPage = false,
  onLoadMore,
  currentPage = 0,
  totalPages = 1,
  onPageChange,
  isMobile = false,
  searchTerm,
  emptyMessage = 'Nenhuma aula encontrada',
}) => {
  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <LessonCardSkeleton key={i} compact />
        ))}
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-muted p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Play className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} compact />
        ))}
      </div>

      {/* Mobile: Load more button */}
      {isMobile && hasNextPage && onLoadMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="rounded-full px-8"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : (
              'Carregar mais'
            )}
          </Button>
        </div>
      )}

      {/* Desktop: Pagination */}
      {!isMobile && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
            className="rounded-full"
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Página {currentPage + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="rounded-full"
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
};
