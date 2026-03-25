import React from 'react';
import { Link } from 'react-router-dom';
import { useFavorites, useToggleFavorite } from '@/hooks/useUserData';
import { Button } from '@/components/ui/button';
import { Heart, Loader2 } from 'lucide-react';
import { LessonCard, LessonCardSkeleton } from '@/components/user/LessonCard';

const UserFavorites: React.FC = () => {
  const { data: favorites = [], isLoading } = useFavorites();
  const toggleFavorite = useToggleFavorite();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Aulas para Rever</h1>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <LessonCardSkeleton key={i} compact />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Aulas para Rever</h1>
        <p className="text-muted-foreground">
          {favorites.length} {favorites.length === 1 ? 'aula salva' : 'aulas salvas'}
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-muted p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Heart className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium mb-4">
            Você ainda não tem aulas para rever
          </p>
          <Button asChild className="rounded-full">
            <Link to="/app">Explorar Aulas</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {favorites.map((fav) => (
            fav.recipe && (
              <LessonCard 
                key={fav.id} 
                lesson={{
                  id: fav.recipe_id,
                  name: fav.recipe.name,
                  image_url: fav.recipe.image_url,
                  servings: fav.recipe.servings,
                }} 
                compact 
              />
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default UserFavorites;
