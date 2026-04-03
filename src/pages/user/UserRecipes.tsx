import React from 'react';
import { Link } from 'react-router-dom';
import { useExclusivePosts } from '@/hooks/useExclusivePosts';
import { Loader2, Wine } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const UserRecipes: React.FC = () => {
  const { data: recipes = [], isLoading } = useExclusivePosts(true);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Receitas</h1>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Receitas</h1>
        <p className="text-muted-foreground">{recipes.length} receitas disponíveis</p>
      </div>

      {recipes.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-muted p-12 text-center">
          <Wine className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma receita disponível no momento</p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <Link key={recipe.id} to={`/app/receita/${recipe.id}`}>
              <div className="group overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                {recipe.cover_image_url ? (
                  <div className="aspect-video overflow-hidden rounded-2xl">
                    <img
                      src={recipe.cover_image_url}
                      alt={recipe.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center rounded-2xl">
                    <Wine className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserRecipes;
