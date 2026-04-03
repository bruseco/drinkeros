import React from 'react';
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
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <Card key={recipe.id} className="overflow-hidden">
              {recipe.cover_image_url ? (
                <img
                  src={recipe.cover_image_url}
                  alt={recipe.title}
                  className="w-full h-44 object-cover"
                />
              ) : (
                <div className="w-full h-44 bg-muted flex items-center justify-center">
                  <Wine className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-foreground line-clamp-2">{recipe.title}</h3>
                {recipe.characteristics && recipe.characteristics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {recipe.characteristics.slice(0, 3).map((c, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                )}
                {recipe.ingredients && recipe.ingredients.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {recipe.ingredients.length} ingredientes
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserRecipes;
