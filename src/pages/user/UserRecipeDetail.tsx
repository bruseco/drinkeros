import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FullscreenVideo } from '@/components/user/FullscreenVideo';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useExclusivePost } from '@/hooks/useExclusivePosts';
import { useFavorites, useToggleFavorite } from '@/hooks/useUserData';
import { useRecipeAccessGuard } from '@/hooks/useRecipeAccessGuard';
import { useRelatedRecipes } from '@/hooks/useRelatedRecipes';
import { useUserPlan } from '@/hooks/useUserPlan';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Heart, Share2, Wine, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import FavoriteDialog from '@/components/user/FavoriteDialog';
import RelatedRecipesSection from '@/components/user/RelatedRecipesSection';
import RecipeYieldLine from '@/components/user/RecipeYieldLine';
import { useTrackExclusivePostView } from '@/hooks/useAccessTracking';
import { useViewContent } from '@/hooks/useViewContent';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  getRecipeFeedOrder,
  findRecipeIndex,
  recipeKey,
  recipeRoute,
  setRecipeScrollTarget,
} from '@/lib/recipesFeedNav';

const UserRecipeDetail: React.FC = () => {
  const { id: idOrSlug } = useParams<{ id: string }>();
  const { data: recipe, isLoading } = useExclusivePost(idOrSlug || '');
  useTrackExclusivePostView(recipe?.id);
  useViewContent({
    key: recipe?.id,
    content_name: recipe?.title,
    content_category: 'receita',
    content_type: 'product',
    content_ids: recipe?.id ? [recipe.id] : undefined,
  });
  const { data: favorites = [] } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showFavoriteDialog, setShowFavoriteDialog] = useState(false);
  const { check: checkAccess } = useRecipeAccessGuard();
  const { isSuperAdmin } = useAuth();
  const isMobile = useIsMobile();

  // ---- Swipe navigation between recipes (mobile only) ----
  const feedOrder = useMemo(() => getRecipeFeedOrder(), []);
  const currentIndex = useMemo(
    () => findRecipeIndex(feedOrder, idOrSlug || ''),
    [feedOrder, idOrSlug]
  );
  const prevItem = currentIndex > 0 ? feedOrder[currentIndex - 1] : null;
  const nextItem =
    currentIndex >= 0 && currentIndex < feedOrder.length - 1
      ? feedOrder[currentIndex + 1]
      : null;

  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [committing, setCommitting] = useState<'prev' | 'next' | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; t: number; locked: 'h' | 'v' | null } | null>(null);

  const commitNavigate = useCallback(
    (target: typeof prevItem) => {
      if (!target) return;
      setRecipeScrollTarget(recipeKey(target));
      navigate(recipeRoute(target), { replace: true });
    },
    [navigate]
  );

  // Reset transform whenever the route changes (new recipe is rendered)
  useEffect(() => {
    setDragX(0);
    setIsDragging(false);
    setCommitting(null);
  }, [idOrSlug]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile || committing) return;
    const t = e.touches[0];
    dragStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), locked: null };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const start = dragStartRef.current;
    if (!start || committing) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (!start.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      start.locked = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
    }
    if (start.locked !== 'h') return;

    // Rubber-band when there's no neighbor in that direction (glue resistance)
    let effective = dx;
    if ((dx < 0 && !nextItem) || (dx > 0 && !prevItem)) {
      effective = dx * 0.25;
    }
    setIsDragging(true);
    setDragX(effective);
  };

  const onTouchEnd = () => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start || start.locked !== 'h') {
      setIsDragging(false);
      return;
    }
    const width = swipeContainerRef.current?.clientWidth || window.innerWidth;
    const elapsed = Date.now() - start.t;
    const velocity = Math.abs(dragX) / Math.max(elapsed, 1); // px/ms
    const threshold = width * 0.28;
    const fastFlick = velocity > 0.5 && Math.abs(dragX) > 40;

    if (dragX < 0 && nextItem && (Math.abs(dragX) > threshold || fastFlick)) {
      setCommitting('next');
      setDragX(-width);
      setIsDragging(false);
      window.setTimeout(() => commitNavigate(nextItem), 260);
    } else if (dragX > 0 && prevItem && (Math.abs(dragX) > threshold || fastFlick)) {
      setCommitting('prev');
      setDragX(width);
      setIsDragging(false);
      window.setTimeout(() => commitNavigate(prevItem), 260);
    } else {
      setIsDragging(false);
      setDragX(0);
    }
  };

  const handleBackToFeed = () => {
    if (feedOrder.length > 0 && idOrSlug) {
      setRecipeScrollTarget(recipeKey({ id: recipe?.id || idOrSlug, slug: recipe?.slug ?? idOrSlug }));
      navigate('/app/receitas');
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/app/receitas');
    }
  };


  const recipeId = recipe?.id;
  const isFavorite = favorites.some((f) => f.recipe_id === recipeId);
  const { data: planData } = useUserPlan();
  const { isVip: hasFullRecipeAccess } = useRecipeAccessGuard();
  const isLockedForUser = planData ? !hasFullRecipeAccess : false;
  const { data: related } = useRelatedRecipes(recipe);

  // Plan access guard (Free users: 1/day limit + Xaropes block)
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

  const showSwipe = isMobile && feedOrder.length > 1 && currentIndex >= 0;

  return (
    <div className="pb-24 overflow-x-hidden">
      <div
        ref={swipeContainerRef}
        onTouchStart={showSwipe ? onTouchStart : undefined}
        onTouchMove={showSwipe ? onTouchMove : undefined}
        onTouchEnd={showSwipe ? onTouchEnd : undefined}
        onTouchCancel={showSwipe ? onTouchEnd : undefined}
        style={{
          transform: `translate3d(${dragX}px, 0, 0)`,
          transition: isDragging
            ? 'none'
            : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >

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
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={handleBackToFeed}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
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
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">{recipe.title}</h1>
          <RecipeYieldLine
            yieldMl={(recipe as any).yield_ml}
            drinksCount={(recipe as any).drinks_count}
            servesPeople={(recipe as any).serves_people}
          />
        </div>

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

        {related?.isSyrup && related.drinksWithSyrup.length > 0 && (
          <RelatedRecipesSection
            title="Drinks com esse xarope"
            recipes={related.drinksWithSyrup}
            isLockedForUser={isLockedForUser}
          />
        )}

        {related?.isSyrup && related.otherSyrups.length > 0 && (
          <RelatedRecipesSection
            title="Veja mais xaropes"
            recipes={related.otherSyrups}
            isLockedForUser={isLockedForUser}
          />
        )}

        {!related?.isSyrup && related && related.family.length > 0 && (
          <RelatedRecipesSection
            title="Drinks da mesma família"
            recipes={related.family}
            isLockedForUser={isLockedForUser}
          />
        )}

        {!related?.isSyrup && related && related.similar.length > 0 && (
          <RelatedRecipesSection
            title="Drinks similares"
            recipes={related.similar}
            isLockedForUser={isLockedForUser}
          />
        )}
      </div>
      </div>
      {/* /swipe wrapper */}


      {isSuperAdmin && recipeId && createPortal(
        <button
          onClick={() => navigate(`/admin/receitas/${recipeId}`)}
          aria-label="Editar receita"
          className="fixed right-4 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition lg:bottom-6"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
        >
          <Pencil className="h-5 w-5" />
        </button>,
        document.body
      )}

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
