import React, { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Heart, MessageCircle, Search, Trophy, Loader2, Sparkles, ChefHat, Plus, Bookmark } from 'lucide-react';
import { useSaveClubRecipe } from '@/hooks/useCollections';

import { format, formatDistanceToNow, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useClubRanking,
  useClubRecipesSearch,
  useClubComments,
  useCreateClubComment,
  useToggleRecipeLike,
  useMyClubLikes,
  type ClubRecipeRow,
} from '@/hooks/useClubFeed';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const fmtRelative = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });

const fmtDayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return 'Hoje';
  if (isSameDay(d, yest)) return 'Ontem';
  return format(d, "d 'de' MMMM", { locale: ptBR });
};

const Initials = ({ name }: { name?: string | null }) => {
  const i = (name || 'D').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return <>{i}</>;
};

/* ---------- Comments (used inside recipe cards) ---------- */
const CommentsBlock: React.FC<{ targetId: string; expandedDefault?: boolean }> = ({
  targetId,
  expandedDefault = false,
}) => {
  const [expanded, setExpanded] = useState(expandedDefault);
  const [draft, setDraft] = useState('');
  const { data: comments = [], isLoading } = useClubComments('recipe', targetId);
  const create = useCreateClubComment();
  const visible = expanded ? comments : comments.slice(-3);

  const submit = async () => {
    if (!draft.trim()) return;
    try {
      await create.mutateAsync({ targetType: 'recipe', targetId, body: draft });
      setDraft('');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao comentar');
    }
  };

  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      {isLoading && <div className="text-xs text-muted-foreground">carregando comentários…</div>}
      {!isLoading && comments.length > 3 && !expanded && (
        <button className="text-xs text-primary hover:underline" onClick={() => setExpanded(true)}>
          Carregar mais {comments.length - 3} comentário{comments.length - 3 > 1 ? 's' : ''}
        </button>
      )}
      <div className="space-y-2">
        {visible.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <Avatar className="h-6 w-6 shrink-0">
              {c.author_avatar && <AvatarImage src={c.author_avatar} />}
              <AvatarFallback className="text-[10px]"><Initials name={c.author_name} /></AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="bg-background/60 rounded-2xl px-3 py-1.5">
                <div className="text-[11px] font-medium truncate">{c.author_name || 'Sócio'}</div>
                <div className="text-sm whitespace-pre-wrap break-words">{c.body}</div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 ml-2">{fmtRelative(c.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Comentar…"
          className="h-9 text-sm"
          maxLength={1000}
        />
        <Button size="sm" variant="ghost" disabled={!draft.trim() || create.isPending} onClick={submit}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
        </Button>
      </div>
    </div>
  );
};

/* ---------- Recipe Card ---------- */
const RecipeCard: React.FC<{
  recipe: Pick<
    ClubRecipeRow,
    'id' | 'user_id' | 'author_name' | 'author_avatar' | 'name' | 'image_url' | 'description' | 'ingredients' | 'likes_count' | 'comments_count' | 'created_at'
  >;
  isLiked: boolean;
}> = ({ recipe, isLiked }) => {
  const toggle = useToggleRecipeLike();
  const save = useSaveClubRecipe();
  const { user } = useAuth();
  const isOwn = user?.id === recipe.user_id;

  return (
    <Card className="overflow-hidden">
      {recipe.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          <img src={recipe.image_url} alt={recipe.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            {recipe.author_avatar && <AvatarImage src={recipe.author_avatar} />}
            <AvatarFallback className="text-[10px]"><Initials name={recipe.author_name} /></AvatarFallback>
          </Avatar>
          <div className="text-[11px] text-muted-foreground min-w-0 flex-1 truncate">
            {recipe.author_name || 'Sócio'}
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            <ChefHat className="h-3 w-3" /> Receita
          </span>
        </div>

        <div className="font-semibold text-base leading-snug">{recipe.name}</div>
        {recipe.description && (
          <div className="text-sm text-muted-foreground line-clamp-2">{recipe.description}</div>
        )}
        {recipe.ingredients && (
          <div className="text-xs text-muted-foreground/90 line-clamp-3 whitespace-pre-line">{recipe.ingredients}</div>
        )}

        <div className="flex items-center gap-4 pt-1">
          <button
            className={`inline-flex items-center gap-1 text-sm transition ${isLiked ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(recipe.id)}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
            <span>{recipe.likes_count}</span>
          </button>
          <div className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <span>{recipe.comments_count}</span>
          </div>
          {!isOwn && (
            <button
              className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition disabled:opacity-50"
              disabled={save.isPending}
              onClick={() => save.mutate(recipe.id)}
              title="Salvar em Favoritos (Clube dos Drinkeros)"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
              <span className="hidden sm:inline">Salvar</span>
            </button>
          )}
        </div>

        <CommentsBlock targetId={recipe.id} />
      </div>
    </Card>
  );
};

/* ---------- Ranking Sheet ---------- */
const RankingSheet: React.FC<{ className?: string }> = ({ className }) => {
  const { data = [], isLoading } = useClubRanking('all');

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className={cn("gap-1", className)}>
          <Trophy className="h-4 w-4" /> Ranking
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Ranking de receitas</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
          {!isLoading && data.length === 0 && (
            <div className="text-sm text-muted-foreground">Sem receitas curtidas ainda.</div>
          )}
          {data.map((r, idx) => (
            <Card key={r.recipe_id} className="p-2 flex items-center gap-3">
              <div className="text-lg font-bold w-6 text-center text-muted-foreground">{idx + 1}</div>
              {r.recipe_image ? (
                <img src={r.recipe_image} alt={r.recipe_name} className="h-12 w-12 rounded-md object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center"><ChefHat className="h-5 w-5 text-muted-foreground" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{r.recipe_name}</div>
                <div className="text-xs text-muted-foreground truncate">{r.author_name || 'Sócio'}</div>
              </div>
              <div className="inline-flex items-center gap-1 text-sm text-primary">
                <Heart className="h-4 w-4 fill-current" /> {r.likes_count}
              </div>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

/* ---------- Main page ---------- */
const UserClube: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [q, setQ] = useState('');
  const { data = [], isLoading } = useClubRecipesSearch(q);
  const { data: myLikes } = useMyClubLikes();
  const likes = useMemo(() => myLikes ?? new Set<string>(), [myLikes]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-md py-10 px-4 text-center space-y-4 pb-24 md:pb-10">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Clube de Receitas</h1>
        <p className="text-sm text-muted-foreground">
          Entre com sua conta para descobrir receitas exclusivas e compartilhar as suas criações.
        </p>
        <Button onClick={() => navigate('/login')}>Entrar</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold leading-tight">Clube de Receitas</h1>
          <p className="text-xs text-muted-foreground">Descubra, curta e compartilhe receitas!</p>
        </div>
      </div>

      <div
        className="sticky z-10 bg-background -mx-4 px-4 py-3 space-y-3 top-[calc(var(--top-banner-h,0px)+4rem)] lg:top-[var(--top-banner-h,0px)]"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome do drink ou ingrediente…"
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <RankingSheet className="w-full" />
          <Button
            onClick={() => navigate('/app/clube/receita/nova')}
            className="w-full"
            size="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Compartilhe sua receita!
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
      {!isLoading && data.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">Nenhuma receita encontrada.</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.map((r) => (
          <RecipeCard key={r.id} recipe={r} isLiked={likes.has(r.id)} />
        ))}
      </div>
    </div>
  );
};

export default UserClube;
