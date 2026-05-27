import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { FullscreenVideo } from '@/components/user/FullscreenVideo';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useExclusivePost, useExclusivePostsPaginated } from '@/hooks/useExclusivePosts';
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
  type RecipeFeedItem,
} from '@/lib/recipesFeedNav';

/**
 * Lightweight preview of a neighbor recipe used on the swipe strip.
 * Fetches the data via the same react-query key as the detail page so
 * once the user commits, the next page renders instantly.
 */
const NeighborPreview: React.FC<{ item: RecipeFeedItem | null }> = ({ item }) => {
  const { data } = useExclusivePost(item ? (item.slug || item.id) : '');
  if (!item) return <div className="w-screen shrink-0" />;
  return (
    <div className="w-screen shrink-0">
      {data?.cover_image_url ? (
        <div className="w-full aspect-video bg-black">
          <img
            src={data.cover_image_url}
            alt={data.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full aspect-video bg-black" />
      )}
      <div className="px-4 py-3 h-12" />
      <div className="px-4">
        <h1 className="text-3xl font-bold text-foreground">
          {data?.title || ''}
        </h1>
      </div>
    </div>
  );
};

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
  const location = useLocation();
  const [showFavoriteDialog, setShowFavoriteDialog] = useState(false);
  const { check: checkAccess } = useRecipeAccessGuard();
  const { isSuperAdmin } = useAuth();
  const isMobile = useIsMobile();

  // ---- Swipe navigation between recipes (mobile only) ----
  // Read the same filters the listing page is using so we can rehydrate the
  // exact same react-query cache and keep extending it with fetchNextPage.
  const listState = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('user-recipes:list-state');
      return raw ? (JSON.parse(raw) as { search?: string; category?: string | null }) : null;
    } catch {
      return null;
    }
  }, []);

  const {
    data: pagedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useExclusivePostsPaginated({
    search: listState?.search || '',
    pageSize: 15,
    publishedOnly: true,
    randomOrder: true as const,
    characteristicFilter: listState?.category || undefined,
  });

  // Live feed order — prefer the paginated cache (so newly fetched pages flow
  // straight into the swipe carousel). Fall back to the sessionStorage snapshot
  // (used when arriving via deep link / no listing in cache).
  // Start from the sessionStorage snapshot saved by the listing so the swipe
  // carousel is ready on the very first render. Then append any newly fetched
  // pages that aren't already in the list (preserves saved order — avoids
  // re-seeding random and losing the current recipe's index).
  const savedOrder = useMemo(() => {
    const stateOrder = (location.state as { recipeFeedOrder?: RecipeFeedItem[] } | null)?.recipeFeedOrder;
    if (Array.isArray(stateOrder) && stateOrder.length > 0) return stateOrder;
    return getRecipeFeedOrder();
  }, [location.state]);
  const feedOrder = useMemo(() => {
    const seen = new Set<string>();
    const out: RecipeFeedItem[] = [];
    for (const r of savedOrder) {
      const key = r.slug || r.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    const rows = pagedData?.pages.flatMap((p) => p.posts) ?? [];
    for (const r of rows) {
      const key = (r as any).slug || r.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: r.id, slug: (r as any).slug ?? null });
    }
    return out;
  }, [pagedData, savedOrder]);

  const currentIndex = useMemo(
    () => findRecipeIndex(feedOrder, idOrSlug || ''),
    [feedOrder, idOrSlug]
  );
  const feedOrderRef = useRef<RecipeFeedItem[]>([]);
  useEffect(() => {
    feedOrderRef.current = feedOrder;
  }, [feedOrder]);

  // Looping helpers: when there are no more pages to load, wrapping around
  // (last → first, first → last) gives the user the looping behaviour they
  // expect on filtered lists.
  const canLoop = feedOrder.length > 1 && !hasNextPage;
  const prevItem =
    currentIndex > 0
      ? feedOrder[currentIndex - 1]
      : canLoop && currentIndex === 0
        ? feedOrder[feedOrder.length - 1]
        : null;
  const nextItem =
    currentIndex >= 0 && currentIndex < feedOrder.length - 1
      ? feedOrder[currentIndex + 1]
      : canLoop && currentIndex === feedOrder.length - 1
        ? feedOrder[0]
        : null;

  // Prefetch the next page when the user is approaching the tail of the
  // loaded feed (within 3 items). Keeps swiping right uninterrupted on the
  // unfiltered Home feed.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (currentIndex < 0) return;
    if (currentIndex >= feedOrder.length - 3) {
      fetchNextPage();
    }
  }, [currentIndex, feedOrder.length, hasNextPage, isFetchingNextPage, fetchNextPage]);


  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [committing, setCommitting] = useState<'prev' | 'next' | null>(null);
  const dragXRef = useRef(0);
  const commitRef = useRef<typeof committing>(null);
  const prevItemRef = useRef<typeof prevItem>(null);
  const nextItemRef = useRef<typeof nextItem>(null);
  // When we navigate to a neighbor via swipe, we need to snap the strip back
  // to the centered (0px) transform WITHOUT a transition — otherwise the new
  // recipe (now centered) animates from the edge, looking like a duplicate
  // slide-in. We turn transitions off for one frame after the route changes.
  const [snap, setSnap] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; t: number; pointerId: number; locked: 'h' | 'v' | null } | null>(null);

  const commitNavigate = useCallback(
    (target: typeof prevItem) => {
      if (!target) return;
      setRecipeScrollTarget(recipeKey(target));
      navigate(recipeRoute(target), {
        replace: true,
        state: { recipeFeedOrder: feedOrderRef.current },
      });
    },
    [navigate]
  );

  useEffect(() => {
    prevItemRef.current = prevItem;
    nextItemRef.current = nextItem;
  }, [prevItem, nextItem]);

  // Reset transform before the browser paints a route change. This prevents the
  // newly loaded recipe from animating back from the edge after a successful swipe.
  useLayoutEffect(() => {
    setSnap(true);
    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false);
    setCommitting(null);
    // Re-enable transitions on the next frame so future drags animate normally.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSnap(false));
    });
    return () => cancelAnimationFrame(raf);
  }, [idOrSlug]);

  useEffect(() => {
    dragXRef.current = dragX;
  }, [dragX]);

  useEffect(() => {
    commitRef.current = committing;
  }, [committing]);

  const finishSwipe = useCallback(() => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start || start.locked !== 'h') {
      setIsDragging(false);
      return;
    }
    const width = swipeContainerRef.current?.clientWidth || window.innerWidth;
    const elapsed = Date.now() - start.t;
    const currentDx = dragXRef.current;
    const velocity = Math.abs(currentDx) / Math.max(elapsed, 1);
    const threshold = width * 0.22;
    const fastFlick = velocity > 0.35 && Math.abs(currentDx) > 28;
    const next = nextItemRef.current;
    const prev = prevItemRef.current;

    if (currentDx < 0 && next && (Math.abs(currentDx) > threshold || fastFlick)) {
      setCommitting('next');
      dragXRef.current = -width;
      setDragX(-width);
      setIsDragging(false);
      window.setTimeout(() => commitNavigate(next), 260);
    } else if (currentDx > 0 && prev && (Math.abs(currentDx) > threshold || fastFlick)) {
      setCommitting('prev');
      dragXRef.current = width;
      setDragX(width);
      setIsDragging(false);
      window.setTimeout(() => commitNavigate(prev), 260);
    } else {
      dragXRef.current = 0;
      setIsDragging(false);
      setDragX(0);
    }
  }, [commitNavigate]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile || commitRef.current || event.pointerType === 'mouse') return;
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      t: Date.now(),
      pointerId: event.pointerId,
      locked: null,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [isMobile]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || commitRef.current || event.pointerId !== start.pointerId) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (!start.locked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      start.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (start.locked === 'v') {
        dragStartRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        return;
      }
    }

    if (start.locked !== 'h') return;
    event.preventDefault();

    let effective = dx;
    if ((dx < 0 && !nextItemRef.current) || (dx > 0 && !prevItemRef.current)) {
      effective = dx * 0.25;
    }
    dragXRef.current = effective;
    setIsDragging(true);
    setDragX(effective);
  }, []);

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (start && event.pointerId === start.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    finishSwipe();
  }, [finishSwipe]);


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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          touchAction: showSwipe ? 'pan-y pinch-zoom' : undefined,
          overscrollBehaviorX: showSwipe ? 'contain' : undefined,
        }}
      >
      <div
        data-recipe-swipe-strip
        style={
          showSwipe
            ? {
                display: 'flex',
                width: '300vw',
                transform: `translate3d(calc(-33.3333% + ${dragX}px), 0, 0)`,
                transition: isDragging || snap
                  ? 'none'
                  : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                willChange: 'transform',
              }
            : undefined
        }
      >
      {showSwipe && <NeighborPreview item={prevItem} />}
      <div className={showSwipe ? 'w-screen shrink-0' : undefined}>

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
      {/* /current panel */}
      {showSwipe && <NeighborPreview item={nextItem} />}
      </div>
      {/* /strip */}
      </div>
      {/* /swipe container */}


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
