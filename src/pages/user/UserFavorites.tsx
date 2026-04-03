import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFavorites } from '@/hooks/useUserData';
import { useCollections, useCollectionRecipes, useDeleteCollection } from '@/hooks/useCollections';
import { Button } from '@/components/ui/button';
import { Heart, FolderOpen, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { LessonCard, LessonCardSkeleton } from '@/components/user/LessonCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const UserFavorites: React.FC = () => {
  const { data: favorites = [], isLoading: loadingFavs } = useFavorites();
  const { data: collections = [], isLoading: loadingCols } = useCollections();
  const { data: collectionRecipes = [], isLoading: loadingCR } = useCollectionRecipes();
  const deleteCollection = useDeleteCollection();
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());

  const isLoading = loadingFavs || loadingCols || loadingCR;

  const toggleExpand = (id: string) => {
    setExpandedLists((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Recipes in any collection (to separate from "ungrouped" favorites)
  const recipesInCollections = new Set(collectionRecipes.map((cr) => cr.recipe_id));

  // Ungrouped favorites = favorites NOT in any collection
  const ungroupedFavorites = favorites.filter((f) => !recipesInCollections.has(f.recipe_id));

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Favoritos</h1>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <LessonCardSkeleton key={i} compact />
          ))}
        </div>
      </div>
    );
  }

  const totalCount = favorites.length;

  return (
    <div className="container mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Favoritos</h1>
        <p className="text-muted-foreground">
          {totalCount} {totalCount === 1 ? 'receita salva' : 'receitas salvas'}
        </p>
      </div>

      {totalCount === 0 && collections.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-muted p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Heart className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium mb-4">
            Você ainda não tem favoritos
          </p>
          <Button asChild className="rounded-full">
            <Link to="/app/receitas">Explorar Receitas</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Collections */}
          {collections.map((col) => {
            const colRecipes = collectionRecipes.filter((cr) => cr.collection_id === col.id);
            const isExpanded = expandedLists.has(col.id);

            return (
              <div key={col.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleExpand(col.id)}
                    className="flex items-center gap-2 text-left"
                  >
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-foreground">{col.name}</span>
                    <span className="text-sm text-muted-foreground">({colRecipes.length})</span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir lista "{col.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          As receitas continuarão nos seus favoritos, mas a lista será removida.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCollection.mutate(col.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {isExpanded && (
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {colRecipes.map((cr) =>
                      cr.recipe ? (
                        <LessonCard
                          key={cr.id}
                          lesson={{
                            id: cr.recipe_id,
                            name: (cr.recipe as any).name,
                            image_url: (cr.recipe as any).image_url,
                            servings: (cr.recipe as any).servings,
                          }}
                          compact
                        />
                      ) : null
                    )}
                    {colRecipes.length === 0 && (
                      <p className="col-span-full text-sm text-muted-foreground py-4">
                        Nenhuma receita nesta lista
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped favorites */}
          {ungroupedFavorites.length > 0 && (
            <div className="space-y-3">
              {collections.length > 0 && (
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  <span className="font-semibold text-foreground">Sem lista</span>
                  <span className="text-sm text-muted-foreground">({ungroupedFavorites.length})</span>
                </div>
              )}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {ungroupedFavorites.map((fav) =>
                  fav.recipe ? (
                    <LessonCard
                      key={fav.id}
                      lesson={{
                        id: fav.recipe_id,
                        name: (fav.recipe as any).name,
                        image_url: (fav.recipe as any).image_url,
                        servings: (fav.recipe as any).servings,
                      }}
                      compact
                    />
                  ) : null
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserFavorites;
