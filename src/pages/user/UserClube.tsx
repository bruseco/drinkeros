import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Heart, MessageCircle, Search, Send, Trophy, Loader2, Sparkles, ChefHat, ChevronUp } from 'lucide-react';
import { format, formatDistanceToNow, isSameDay } from 'date-fns';
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
  type ClubFeedItem,
  type ClubRecipeRow,
} from '@/hooks/useClubFeed';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const fmtRelative = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });

const fmtTime = (iso: string) => format(new Date(iso), 'HH:mm');

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

/* ---------- Comments (used inside recipe bubbles) ---------- */
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
        <button className="text-xs text-primary hover:underline" onClick={() => setExpanded(true)}>
          Ver todos os {comments.length} comentários
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
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

/* ---------- Recipe Card (used in Receitas tab and as chat bubble) ---------- */
const RecipeCard: React.FC<{
  recipe: Pick<
    ClubRecipeRow,
    'id' | 'user_id' | 'author_name' | 'author_avatar' | 'name' | 'image_url' | 'description' | 'ingredients' | 'likes_count' | 'comments_count' | 'created_at'
  >;
  isLiked: boolean;
  compact?: boolean;
}> = ({ recipe, isLiked, compact }) => {
  const toggle = useToggleRecipeLike();
  const [showComments, setShowComments] = useState(false);

  return (
    <Card className="overflow-hidden">
      {recipe.image_url && (
        <div className={`${compact ? 'aspect-[16/10]' : 'aspect-[4/3]'} w-full overflow-hidden bg-muted`}>
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
        {recipe.ingredients && !compact && (
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

/* ---------- WhatsApp-style chat bubble for text posts ---------- */
const ChatMessage: React.FC<{ item: ClubFeedItem; isMine: boolean; likes: Set<string> }> = ({ item, isMine, likes }) => {
  if (item.kind === 'recipe') {
    // Recipe card as bubble (full width-ish, centered look but aligned by author)
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-2`}>
        {!isMine && (
          <Avatar className="h-8 w-8 shrink-0 mt-1">
            {item.author_avatar && <AvatarImage src={item.author_avatar} />}
            <AvatarFallback className="text-[11px]"><Initials name={item.author_name} /></AvatarFallback>
          </Avatar>
        )}
        <div className="max-w-[85%] sm:max-w-[75%] w-full">
          {!isMine && (
            <div className="text-[11px] text-muted-foreground mb-1 ml-2">{item.author_name || 'Sócio'}</div>
          )}
          <RecipeCard
            recipe={{
              id: item.id,
              user_id: item.user_id,
              author_name: item.author_name,
              author_avatar: item.author_avatar,
              name: item.recipe_name || '',
              image_url: item.recipe_image,
              description: item.recipe_description,
              ingredients: item.ingredients,
              likes_count: item.likes_count,
              comments_count: item.comments_count,
              created_at: item.created_at,
            }}
            isLiked={likes.has(item.id)}
            compact
          />
          <div className={`text-[10px] text-muted-foreground mt-1 ${isMine ? 'text-right mr-2' : 'ml-2'}`}>
            {fmtTime(item.created_at)}
          </div>
        </div>
      </div>
    );
  }

  // Text post bubble
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-2`}>
      {!isMine && (
        <Avatar className="h-8 w-8 shrink-0 mt-1">
          {item.author_avatar && <AvatarImage src={item.author_avatar} />}
          <AvatarFallback className="text-[11px]"><Initials name={item.author_name} /></AvatarFallback>
        </Avatar>
      )}
      <div className={`max-w-[80%] sm:max-w-[70%]`}>
        <div
          className={`rounded-2xl px-3 py-2 shadow-sm ${
            isMine
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-card text-foreground rounded-bl-sm border border-border/60'
          }`}
        >
          {!isMine && (
            <div className="text-[11px] font-medium opacity-80 mb-0.5">{item.author_name || 'Sócio'}</div>
          )}
          <div className="text-sm whitespace-pre-wrap break-words">{item.body}</div>
          <div className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'}`}>
            {fmtTime(item.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Chat Tab ---------- */
const ChatTab: React.FC<{ likes: Set<string> }> = ({ likes }) => {
  const { user } = useAuth();
  const feedQuery = useClubFeed('all');
  const create = useCreateClubPost();
  const [body, setBody] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Feed pages come newest-first; flatten and reverse so newest is at bottom (chat style).
  const items = useMemo(() => {
    const flat = feedQuery.data?.pages.flat() ?? [];
    return [...flat].reverse();
  }, [feedQuery.data]);

  // Auto-scroll to bottom on first load and when new msg appended at bottom.
  const lastIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (items.length === 0) return;
    const lastId = items[items.length - 1].id;
    if (lastIdRef.current !== lastId) {
      bottomRef.current?.scrollIntoView({ behavior: lastIdRef.current ? 'smooth' : 'auto' });
      lastIdRef.current = lastId;
    }
  }, [items]);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    try {
      setBody('');
      await create.mutateAsync(text);
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao enviar');
      setBody(text);
    }
  };

  // Group by day to render date separators
  const grouped: Array<{ type: 'sep'; key: string; label: string } | { type: 'msg'; item: ClubFeedItem }> = [];
  let lastDay = '';
  for (const it of items) {
    const dayKey = format(new Date(it.created_at), 'yyyy-MM-dd');
    if (dayKey !== lastDay) {
      grouped.push({ type: 'sep', key: `sep-${dayKey}`, label: fmtDayLabel(it.created_at) });
      lastDay = dayKey;
    }
    grouped.push({ type: 'msg', item: it });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[420px] rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {feedQuery.hasNextPage && (
          <div className="flex justify-center pb-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              disabled={feedQuery.isFetchingNextPage}
              onClick={() => feedQuery.fetchNextPage()}
            >
              {feedQuery.isFetchingNextPage ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <ChevronUp className="h-3 w-3 mr-1" />
              )}
              Carregar mensagens anteriores
            </Button>
          </div>
        )}

        {feedQuery.isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!feedQuery.isLoading && items.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">
            Sem mensagens ainda. Manda a primeira!
          </div>
        )}

        {grouped.map((g) =>
          g.type === 'sep' ? (
            <div key={g.key} className="flex justify-center my-3">
              <span className="text-[10px] uppercase tracking-wide bg-background/80 border border-border/60 text-muted-foreground px-2 py-0.5 rounded-full">
                {g.label}
              </span>
            </div>
          ) : (
            <ChatMessage
              key={`${g.item.kind}-${g.item.id}`}
              item={g.item}
              isMine={!!user && g.item.user_id === user.id}
              likes={likes}
            />
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/60 bg-background/80 backdrop-blur p-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Mensagem para o Clube…"
            rows={1}
            maxLength={2000}
            className="resize-none min-h-[40px] max-h-32"
          />
          <Button size="icon" disabled={!body.trim() || create.isPending} onClick={submit} className="shrink-0">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
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
  const [tab, setTab] = useState<'chat' | 'recipes'>('chat');
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

  return (
    <div className="container mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold leading-tight">Clube</h1>
          <p className="text-xs text-muted-foreground">Chat dos sócios, receitas e ranking.</p>
        </div>
        <RankingSheet />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'chat' | 'recipes')}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="recipes">Receitas</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-3">
          <ChatTab likes={likes} />
        </TabsContent>

        <TabsContent value="recipes" className="mt-3">
          <RecipesTab myLikes={likes} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserClube;
