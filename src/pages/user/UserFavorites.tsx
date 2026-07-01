import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFavorites } from '@/hooks/useUserData';
import { useCollections, useCollectionRecipes, useDeleteCollection } from '@/hooks/useCollections';
import { Button } from '@/components/ui/button';
import { Heart, FolderOpen, Trash2, ChevronDown, ChevronUp, GraduationCap } from 'lucide-react';
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
  const { data: collections = [] } = useCollections();
  const { data: collectionRecipes = [] } = useCollectionRecipes();
  const deleteCollection = useDeleteCollection();
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  // Only block on favorites — collections render progressively as they arrive
  const isLoading = loadingFavs;

  // Find the "Cursos" collection
  const cursosCollection = collections.find((c) => c.name === 'Aulas Favoritas' || c.name === 'Aulas' || c.name === 'Cursos');
  const cursosRecipeIds = cursosCollection
    ? collectionRecipes.filter((cr) => cr.collection_id === cursosCollection.id).map((cr) => cr.recipe_id)
    : [];

  // Fetch package (course) info for recipes in "Cursos" collection
  const { data: recipePackageMap = {} } = useQuery({
    queryKey: ['recipe-package-map', cursosRecipeIds.sort().join(',')],
    queryFn: async () => {
      if (cursosRecipeIds.length === 0) return {};
      
      // Get recipe_packages for these recipes
      const { data: rps } = await supabase
        .from('recipe_packages')
        .select('recipe_id, package_id')
        .in('recipe_id', cursosRecipeIds);

      if (!rps || rps.length === 0) return {};

      const packageIds = [...new Set(rps.map((rp) => rp.package_id))];

      // Get course_packages to find course names
      const { data: cps } = await supabase
        .from('course_packages')
        .select('package_id, course:courses(id, name)')
        .in('package_id', packageIds);

      // Build: recipe_id -> course name
      const pkgToCourse: Record<string, string> = {};
      for (const cp of cps || []) {
        if (cp.course) {
          pkgToCourse[cp.package_id] = (cp.course as any).name;
        }
      }

      // Also get package names as fallback
      const { data: pkgs } = await supabase
        .from('packages')
        .select('id, name')
        .in('id', packageIds);

      const pkgNameMap: Record<string, string> = {};
      for (const p of pkgs || []) {
        pkgNameMap[p.id] = p.name;
      }

      const result: Record<string, string> = {};
      for (const rp of rps) {
        // Prefer course name, fallback to package name
        result[rp.recipe_id] = pkgToCourse[rp.package_id] || pkgNameMap[rp.package_id] || 'Curso';
      }
      return result;
    },
    enabled: cursosRecipeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const toggleExpand = (id: string) => {
    setExpandedLists((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCourseExpand = (courseName: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      next.has(courseName) ? next.delete(courseName) : next.add(courseName);
      return next;
    });
  };

  // Recipes in any collection (to separate from "ungrouped" favorites)
  const recipesInCollections = new Set(collectionRecipes.map((cr) => cr.recipe_id));

  // Ungrouped favorites = favorites NOT in any collection
  const ungroupedFavorites = favorites.filter((f) => !recipesInCollections.has(f.recipe_id));

  // Other collections (not "Cursos")
  const otherCollections = collections.filter((c) => c.name !== 'Cursos' && c.name !== 'Aulas' && c.name !== 'Aulas Favoritas');

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

  // Group cursos recipes by course name
  const cursosRecipes = cursosCollection
    ? collectionRecipes.filter((cr) => cr.collection_id === cursosCollection.id)
    : [];

  const courseGroups: Record<string, typeof cursosRecipes> = {};
  for (const cr of cursosRecipes) {
    const courseName = recipePackageMap[cr.recipe_id] || 'Outros';
    if (!courseGroups[courseName]) courseGroups[courseName] = [];
    courseGroups[courseName].push(cr);
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Favoritos</h1>
        <p className="text-muted-foreground">
          {totalCount} {totalCount === 1 ? 'item salvo' : 'itens salvos'}
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
          {/* "Cursos" collection with sub-grouping */}
          {cursosCollection && cursosRecipes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleExpand(cursosCollection.id)}
                  className="flex items-center gap-2 text-left"
                >
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground">Aulas Favoritas</span>
                  <span className="text-sm text-muted-foreground">({cursosRecipes.length})</span>
                  {expandedLists.has(cursosCollection.id) ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>

              {expandedLists.has(cursosCollection.id) && (
                <div className="space-y-2 pl-2">
                  {Object.entries(courseGroups).map(([courseName, recipes]) => {
                    const isCourseExpanded = expandedCourses.has(courseName);
                    return (
                      <div key={courseName} className="space-y-2">
                        <button
                          onClick={() => toggleCourseExpand(courseName)}
                          className="flex items-center gap-2 text-left w-full py-1"
                        >
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm text-foreground">{courseName}</span>
                          <span className="text-xs text-muted-foreground">({recipes.length})</span>
                          {isCourseExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                          )}
                        </button>

                        {isCourseExpanded && (
                          <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 pl-2">
                            {recipes.map((cr) =>
                              cr.recipe ? (
                                <LessonCard
                                  key={cr.id}
                                  lesson={{
                                    id: cr.recipe_id,
                                    name: (cr.recipe as any).name,
                                    image_url: (cr.recipe as any).image_url || (cr.recipe as any).cover_image_url,
                                    servings: (cr.recipe as any).servings,
                                  }}
                                  to={(cr as any).kind === 'receita' ? `/app/receita/${cr.recipe_id}` : `/app/aula/${cr.recipe_id}`}
                                  compact
                                />
                              ) : null
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Other Collections */}
          {otherCollections.map((col) => {
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
                            image_url: (cr.recipe as any).image_url || (cr.recipe as any).cover_image_url,
                            servings: (cr.recipe as any).servings,
                          }}
                          to={(cr as any).kind === 'clube' ? `/app/clube` : (cr as any).kind === 'receita' ? `/app/receita/${cr.recipe_id}` : `/app/aula/${cr.recipe_id}`}
                          compact
                          hideTitle
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
              {(otherCollections.length > 0 || cursosCollection) && (
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
                        name: fav.recipe.name,
                        image_url: fav.recipe.image_url,
                        servings: fav.recipe.servings,
                      }}
                      to={(fav as any).kind === 'receita' ? `/app/receita/${fav.recipe_id}` : `/app/aula/${fav.recipe_id}`}
                      compact
                      hideTitle
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
