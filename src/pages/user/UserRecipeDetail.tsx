import React, { useState, useEffect } from 'react';
import { FullscreenVideo } from '@/components/user/FullscreenVideo';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useExclusivePost } from '@/hooks/useExclusivePosts';
import { useFavorites, useToggleFavorite } from '@/hooks/useUserData';
import { useRecipeAccessGuard } from '@/hooks/useRecipeAccessGuard';
import { useRelatedRecipes } from '@/hooks/useRelatedRecipes';
import { useUserPlan } from '@/hooks/useUserPlan';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Heart, Share2, Wine } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FavoriteDialog from '@/components/user/FavoriteDialog';
import RelatedRecipesSection from '@/components/user/RelatedRecipesSection';

const UserRecipeDetail: React.FC = () => {
  const { id: idOrSlug } = useParams<{ id: string }>();
  const { data: recipe, isLoading } = useExclusivePost(idOrSlug || '');
  const { data: favorites = [] } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showFavoriteDialog, setShowFavoriteDialog] = useState(false);
  const { check: checkAccess } = useRecipeAccessGuard();

  const recipeId = recipe?.id;
  const isFavorite = favorites.some((f) => f.recipe_id === recipeId);
  const { data: planData } = useUserPlan();
  const { isVip: hasFullRecipeAccess } = useRecipeAccessGuard();
  const isLockedForUser = planData ? !hasFullRecipeAccess : false;
  const { data: related } = useRelatedRecipes(recipe);

  // Plan access guard (Free users: 3/day limit + Xaropes block)
  useEffect(() => {
    if (recipe?.id) {
      checkAccess(recipe.id, recipe.characteristics as string[] | null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id]);


  const getYouTubeEmbedUrl = (url: string) => {
    try {
      let videoId = '';
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split(/[?&#]/)[0] || '';
      } else if (url.includes('youtube.com')) {
        const urlObj = new URL(url);
        videoId = urlObj.searchParams.get('v') || '';
        if (!videoId && url.includes('/shorts/')) {
          videoId = url.split('/shorts/')[1]?.split(/[?&#]/)[0] || '';
        }
      }
      if (videoId) {
        return `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3&showinfo=0`;
      }
    } catch {}
    return null;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: recipe?.title, url: window.location.href });
      } catch {}
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Link copiado!' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="container mx-auto px-4 py-6 text-center">
        <p className="text-muted-foreground">Receita não encontrada</p>
        <Link to="/app/receitas">
          <Button variant="link" className="mt-2">Voltar</Button>
        </Link>
      </div>
    );
  }

  const embedUrl = recipe.youtube_url ? getYouTubeEmbedUrl(recipe.youtube_url) : null;

  const instructionLines = recipe.instructions
    ? recipe.instructions.split('\n').filter(l => l.trim())
    : [];

  return (
    <div className="pb-24">

      {/* Video / Cover */}
      {embedUrl ? (
        <FullscreenVideo
          embedUrl={embedUrl}
          title={recipe.title}
          thumbnailUrl={recipe.cover_image_url || undefined}
        />
      ) : recipe.cover_image_url ? (
        <div className="w-full aspect-video bg-black">
          <img src={recipe.cover_image_url} alt={recipe.title} className="w-full h-full object-cover" />
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Link to="/app/receitas">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleShare}>
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => {
            if (!recipeId) return;
            if (isFavorite) {
              toggleFavorite.mutate({ recipeId, isFavorite: true });
            } else {
              setShowFavoriteDialog(true);
            }
          }}
        >
          <Heart className={`h-5 w-5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
        </Button>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 space-y-6">
        <h1 className="text-3xl font-bold text-foreground">{recipe.title}</h1>

        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-foreground mb-2">Ingredientes:</h2>
            <div className="flex flex-wrap gap-1.5">
              {recipe.ingredients.map((ing, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-sm text-amber-500 border-amber-500/40 cursor-pointer hover:bg-amber-500/10 transition-colors"
                  onClick={() => navigate(`/app/receitas?q=${encodeURIComponent(ing)}`)}
                >
                  {ing}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {instructionLines.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">Modo de preparo:</h2>
            <ol className="space-y-2">
              {instructionLines.map((line, i) => {
                const cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();
                return (
                  <li key={i} className="flex gap-3 items-start text-muted-foreground">
                    <span className="font-semibold text-foreground min-w-[28px]">{i + 1}.</span>
                    <span>{cleaned}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {recipe.characteristics && recipe.characteristics.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-foreground mb-2">Características:</h2>
            <div className="flex flex-wrap gap-1.5">
              {recipe.characteristics.map((c, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-sm text-amber-500 border-amber-500/40 cursor-pointer hover:bg-amber-500/10 transition-colors"
                  onClick={() => navigate(`/app/receitas?q=${encodeURIComponent(c)}`)}
                >
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {recipe.description && (
          <div>
            <h2 className="text-lg font-bold text-foreground mb-2">Descrição:</h2>
            <p className="text-muted-foreground whitespace-pre-line">{recipe.description}</p>
          </div>
        )}

        {related && related.family.length > 0 && (
          <RelatedRecipesSection
            title="Drinks da mesma família"
            recipes={related.family}
            isLockedForUser={isLockedForUser}
          />
        )}

        {related && related.similar.length > 0 && (
          <RelatedRecipesSection
            title="Drinks similares"
            recipes={related.similar}
            isLockedForUser={isLockedForUser}
          />
        )}
      </div>

      {recipeId && (
        <FavoriteDialog
          open={showFavoriteDialog}
          onOpenChange={setShowFavoriteDialog}
          recipeId={recipeId}
          isFavorite={isFavorite}
        />
      )}
    </div>
  );
};

export default UserRecipeDetail;
