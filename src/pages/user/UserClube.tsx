import React, { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Heart, MessageCircle, Search, Send, Trophy, Loader2, Sparkles, ChefHat } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useClubFeed,
  useClubRanking,
  useClubRecipesSearch,
  useClubComments,
  useCreateClubPost,
  useCreateClubComment,
  useToggleRecipeLike,
  useMyClubLikes,
  type ClubFeedFilter,
  type ClubFeedItem,
  type ClubRecipeRow,
} from '@/hooks/useClubFeed';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const fmtDate = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });

const Initials = ({ name }: { name?: string | null }) => {
  const i = (name || 'D').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return <>{i}</>;
};

/* ---------- Comments block ---------- */
const CommentsBlock: React.FC<{ targetType: 'post' | 'recipe'; targetId: string; expandedDefault?: boolean }> = ({
  targetType,
  targetId,
  expandedDefault = false,
}) => {
  const [expanded, setExpanded] = useState(expandedDefault);
  const [draft, setDraft] = useState('');
  const { data: comments = [], isLoading } = useClubComments(targetType, targetId);
  const create = useCreateClubComment();
  const visible = expanded ? comments : comments.slice(-3);

  const submit = async () => {
    if (!draft.trim()) return;
    try {
      await create.mutateAsync({ targetType, targetId, body: draft });
      setDraft('');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao comentar');
    }
  };

  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      {isLoading && <div className="text-xs text-muted-foreground">carregando comentários…</div>}
      {!isLoading && comments.length === 0 && (
        <div className="text-xs text-muted-foreground">Seja o primeiro a comentar.</div>
      )}
      {!isLoading && comments.length > 3 && !expanded && (
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => setExpanded(true)}
        >
          Ver todos os {comments.length} comentários
        </button>
      )}
      <div className="space-y-2">
        {visible.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              {c.author_avatar && <AvatarImage src={c.author_avatar} />}
              <AvatarFallback className="text-[10px]"><Initials name={c.author_name} /></AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="bg-muted/40 rounded-2xl px-3 py-1.5">
                <div className="text-xs font-medium truncate">{c.author_name || 'Sócio'}</div>
                <div className="text-sm whitespace-pre-wrap break-words">{c.body}</div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 ml-2">{fmtDate(c.created_at)}</div>
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
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
  const [showComments, setShowComments] = useState(false);

  return (
    <Card className="overflow-hidden">
      {recipe.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          <img src={recipe.image_url} alt={recipe.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            {recipe.author_avatar && <AvatarImage src={recipe.author_avatar} />}
            <AvatarFallback className="text-[10px]"><Initials name={recipe.author_name} /></AvatarFallback>
          </Avatar>
          <div className="text-xs text-muted-foreground min-w-0 flex-1 truncate">
            {recipe.author_name || 'Sócio'} · {fmtDate(recipe.created_at)}
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
          <div className="text-xs text-muted-foreground/90 line-clamp-3 whitespace-pre-line">
            {recipe.ingredients}
          </div>
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
          <button
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setShowComments((v) => !v)}
          >
            <MessageCircle className="h-4 w-4" />
            <span>{recipe.comments_count}</span>
          </button>
        </div>

        {showComments && <CommentsBlock targetType="recipe" targetId={recipe.id} expandedDefault />}
      </div>
    </Card>
  );
};

/* ---------- Post Bubble ---------- */
const PostBubble: React.FC<{ item: ClubFeedItem }> = ({ item }) => {
  const [showComments, setShowComments] = useState(false);
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          {item.author_avatar && <AvatarImage src={item.author_avatar} />}
          <AvatarFallback className="text-[11px]"><Initials name={item.author_name} /></AvatarFallback>
        </Avatar>
        <div className="text-xs min-w-0 flex-1">
          <div className="font-medium truncate">{item.author_name || 'Sócio'}</div>
          <div className="text-muted-foreground">{fmtDate(item.created_at)}</div>
        </div>
      </div>
      <div className="text-sm whitespace-pre-wrap break-words">{item.body}</div>
      <div className="flex items-center gap-4 pt-1">
        <button
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageCircle className="h-4 w-4" />
          <span>{item.comments_count}</span>
        </button>
      </div>
      {showComments && <CommentsBlock targetType="post" targetId={item.id} expandedDefault />}
    </Card>
  );
};

/* ---------- Composer ---------- */
const Composer: React.FC = () => {
  const [body, setBody] = useState('');
  const create = useCreateClubPost();
  const submit = async () => {
    if (!body.trim()) return;
    try {
      await create.mutateAsync(body);
      setBody('');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao postar');
    }
  };
  return (
    <Card className="p-3 space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Compartilhe algo com o Clube — dúvida, dica, drink que você fez…"
        rows={3}
        maxLength={2000}
        className="resize-none"
      />
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-muted-foreground">{body.length}/2000</div>
        <Button size="sm" disabled={!body.trim() || create.isPending} onClick={submit}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          Publicar
        </Button>
      </div>
    </Card>
  );
};

/* ---------- Ranking Sheet ---------- */
const RankingSheet: React.FC = () => {
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const { data = [], isLoading } = useClubRanking(scope);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Trophy className="h-4 w-4" /> Ranking
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Ranking de receitas</SheetTitle>
        </SheetHeader>
        <Tabs value={scope} onValueChange={(v) => setScope(v as any)} className="mt-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="month">Mensal</TabsTrigger>
            <TabsTrigger value="all">Geral</TabsTrigger>
          </TabsList>
          <TabsContent value={scope} className="mt-3 space-y-2">
            {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
            {!isLoading && data.length === 0 && (
              <div className="text-sm text-muted-foreground">Sem receitas curtidas {scope === 'month' ? 'neste mês' : 'ainda'}.</div>
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
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

/* ---------- Recipes Tab (with search) ---------- */
const RecipesTab: React.FC<{ myLikes: Set<string> }> = ({ myLikes }) => {
  const [q, setQ] = useState('');
  const { data = [], isLoading } = useClubRecipesSearch(q);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome do drink ou ingrediente…"
          className="pl-9"
        />
      </div>
      {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
      {!isLoading && data.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">Nenhuma receita encontrada.</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.map((r) => (
          <RecipeCard key={r.id} recipe={r} isLiked={myLikes.has(r.id)} />
        ))}
      </div>
    </div>
  );
};

/* ---------- Main page ---------- */
const UserClube: React.FC = () => {
  const navigate = useNavigate();
  const { data: plan, isLoading: planLoading } = useUserPlan();
  const [filter, setFilter] = useState<ClubFeedFilter>('all');
  const feedQuery = useClubFeed(filter);
  const { data: myLikes } = useMyClubLikes();
  const likes = useMemo(() => myLikes ?? new Set<string>(), [myLikes]);

  if (planLoading) {
    return (
      <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    );
  }

  if (!plan?.isVip) {
    return (
      <div className="container mx-auto max-w-md py-10 px-4 text-center space-y-4 pb-24 md:pb-10">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Clube dos Drinkeros</h1>
        <p className="text-sm text-muted-foreground">
          Esta área é exclusiva para Sócios do Clube. Vire Sócio e participe do chat, poste suas receitas e dispute o ranking.
        </p>
        <Button onClick={() => navigate('/pv-clube')}>Quero entrar no Clube</Button>
      </div>
    );
  }

  const items = feedQuery.data?.pages.flat() ?? [];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold leading-tight">Clube</h1>
          <p className="text-xs text-muted-foreground">Conversas, receitas e ranking dos sócios.</p>
        </div>
        <RankingSheet />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as ClubFeedFilter)}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="all">Tudo</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="recipes">Receitas</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-3 space-y-3">
          <Composer />
          <FeedList items={items} likes={likes} query={feedQuery} />
        </TabsContent>

        <TabsContent value="posts" className="mt-3 space-y-3">
          <Composer />
          <FeedList items={items} likes={likes} query={feedQuery} />
        </TabsContent>

        <TabsContent value="recipes" className="mt-3">
          <RecipesTab myLikes={likes} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const FeedList: React.FC<{ items: ClubFeedItem[]; likes: Set<string>; query: ReturnType<typeof useClubFeed> }> = ({ items, likes, query }) => {
  if (query.isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (items.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-10">Nada por aqui ainda. Abre a conversa!</div>;
  }
  return (
    <div className="space-y-3">
      {items.map((it) =>
        it.kind === 'post' ? (
          <PostBubble key={`p-${it.id}`} item={it} />
        ) : (
          <RecipeCard
            key={`r-${it.id}`}
            recipe={{
              id: it.id,
              user_id: it.user_id,
              author_name: it.author_name,
              author_avatar: it.author_avatar,
              name: it.recipe_name || '',
              image_url: it.recipe_image,
              description: it.recipe_description,
              ingredients: it.ingredients,
              likes_count: it.likes_count,
              comments_count: it.comments_count,
              created_at: it.created_at,
            }}
            isLiked={likes.has(it.id)}
          />
        ),
      )}
      {query.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
            {query.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default UserClube;
