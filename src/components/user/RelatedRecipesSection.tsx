import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wine, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ExclusivePost } from '@/hooks/useExclusivePosts';
import { isVipOnlyCharacteristic } from '@/hooks/useRecipeAccessGuard';

interface Props {
  title: string;
  recipes: ExclusivePost[];
  isLockedForUser: boolean;
}

const PAGE = 6;

const RelatedRecipesSection: React.FC<Props> = ({ title, recipes, isLockedForUser }) => {
  const [visible, setVisible] = useState(PAGE);

  if (!recipes || recipes.length === 0) return null;

  const shown = recipes.slice(0, visible);
  const hasMore = visible < recipes.length;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {shown.map((recipe) => {
          const isLocked = isLockedForUser && isVipOnlyCharacteristic(recipe.characteristics);
          const target = isLocked ? '/clube' : `/app/receita/${(recipe as any).slug || recipe.id}`;
          return (
            <Link key={recipe.id} to={target}>
              <div className="group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative">
                {recipe.cover_image_url ? (
                  <div className="aspect-video overflow-hidden rounded-2xl relative">
                    <img
                      src={recipe.cover_image_url}
                      alt={recipe.title}
                      className={cn(
                        'h-full w-full object-cover transition-transform duration-500 group-hover:scale-105',
                        isLocked && 'brightness-50 saturate-50'
                      )}
                      loading="lazy"
                    />
                    {isLocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="rounded-full bg-purple-600/90 p-3 shadow-lg shadow-purple-500/50">
                          <Lock className="h-5 w-5 text-white" />
                        </div>
                        <span className="rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
                          Exclusivo do Clube
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-2xl bg-muted">
                    <Wine className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
            Ver mais
          </Button>
        </div>
      )}
    </div>
  );
};

export default RelatedRecipesSection;
