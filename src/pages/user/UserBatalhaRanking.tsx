import React, { useState } from 'react';
import {
  useBatalhaRanking,
  useMonthlyRanking,
  useYearlyRanking,
  useGeneralRanking,
  useYearlyVote,
  tierColor,
} from '@/hooks/useBatalha';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy, Loader2, Star, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const monthLabel = (my: string) => {
  const [, m] = my.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return names[Number(m) - 1] || my;
};

const StarRow: React.FC<{ value: number; onClick?: (n: number) => void; readOnly?: boolean }> = ({ value, onClick, readOnly }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        disabled={readOnly}
        onClick={() => onClick?.(n)}
        className={readOnly ? 'cursor-default' : 'cursor-pointer'}
      >
        <Star
          className={`h-4 w-4 ${n <= Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`}
        />
      </button>
    ))}
  </div>
);

const UserBatalhaRanking: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { vote } = useYearlyVote();

  const { data: usersRanking, isLoading: loadingUsers } = useBatalhaRanking();
  const { data: monthly, isLoading: loadingMonthly } = useMonthlyRanking();
  const { data: yearly, isLoading: loadingYearly } = useYearlyRanking();
  const { data: general, isLoading: loadingGeneral } = useGeneralRanking();

  const [voting, setVoting] = useState<string | null>(null);

  const handleYearlyVote = async (winnerId: string, ownerId: string, rating: number) => {
    if (!user) return;
    if (ownerId === user.id) {
      toast.error('Você não pode votar na própria receita');
      return;
    }
    setVoting(winnerId);
    try {
      await vote(winnerId, rating);
      await qc.invalidateQueries({ queryKey: ['club-yearly-ranking'] });
      toast.success('Voto registrado!');
    } catch {
      toast.error('Não foi possível votar');
    } finally {
      setVoting(null);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-6 px-4 pb-24 md:pb-6 space-y-4">
      <div className="flex items-center gap-3">
        <Trophy className="h-6 w-6 text-yellow-500" />
        <h1 className="text-2xl font-bold">Ranking da Batalha</h1>
      </div>

      <Tabs defaultValue="mes" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="ano">Ano</TabsTrigger>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="users">Sócios</TabsTrigger>
        </TabsList>

        {/* MÊS — receitas concorrendo agora */}
        <TabsContent value="mes" className="space-y-2 mt-4">
          <p className="text-xs text-muted-foreground">
            Receitas postadas neste mês concorrendo à vaga de Campeã do Mês.
          </p>
          {loadingMonthly ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !monthly?.length ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">Nenhuma receita neste mês ainda.</Card>
          ) : (
            monthly.map((r, idx) => (
              <Link key={r.recipe_id} to={`/app/batalha/receita/${r.recipe_id}`}>
                <Card className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                  <span className="w-6 text-center font-bold text-muted-foreground text-sm">{idx + 1}º</span>
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.name} className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.author_name || 'Usuário'}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-bold">{r.avg_rating.toFixed(1)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{r.total_votes} votos</p>
                  </div>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        {/* ANO — campeões mensais concorrendo ao prêmio anual */}
        <TabsContent value="ano" className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground">
            Campeãs de cada mês deste ano. Vote nas suas favoritas para escolher a Campeã do Ano!
          </p>
          {loadingYearly ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !yearly?.length ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">
              Ainda não há campeãs mensais neste ano.
            </Card>
          ) : (
            yearly.map((c, idx) => (
              <Card key={c.monthly_winner_id} className="p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-bold text-muted-foreground text-sm">{idx + 1}º</span>
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="h-14 w-14 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">
                        {monthLabel(c.month_year)}
                      </span>
                      <Crown className="h-3 w-3 text-yellow-500" />
                    </div>
                    <Link to={`/app/batalha/receita/${c.recipe_id}`} className="font-semibold text-sm truncate block hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">{c.author_name || 'Usuário'}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-bold">{c.yearly_avg_rating.toFixed(1)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{c.yearly_votes} votos</p>
                  </div>
                </div>
                {user && user.id !== c.user_id && (
                  <div className="flex items-center justify-between pl-9">
                    <span className="text-[11px] text-muted-foreground">
                      {c.user_vote ? `Seu voto: ${c.user_vote}★` : 'Avalie:'}
                    </span>
                    <div className={voting === c.monthly_winner_id ? 'opacity-50 pointer-events-none' : ''}>
                      <StarRow
                        value={c.user_vote || 0}
                        onClick={(n) => handleYearlyVote(c.monthly_winner_id, c.user_id, n)}
                      />
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        {/* GERAL — campeões anuais (histórico) */}
        <TabsContent value="geral" className="space-y-2 mt-4">
          <p className="text-xs text-muted-foreground">Campeãs do Ano (histórico).</p>
          {loadingGeneral ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !general?.length ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">
              Ainda não há campeã anual registrada.
            </Card>
          ) : (
            general.map(c => (
              <Link key={c.year} to={`/app/batalha/receita/${c.recipe_id}`}>
                <Card className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow border-yellow-500/30">
                  <div className="flex flex-col items-center w-12">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    <span className="text-xs font-bold">{c.year}</span>
                  </div>
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="h-14 w-14 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.author_name || 'Usuário'}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-bold">{c.avg_rating.toFixed(1)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{c.total_votes} votos</p>
                  </div>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        {/* SÓCIOS — ranking de pontos (existente) */}
        <TabsContent value="users" className="space-y-2 mt-4">
          <p className="text-xs text-muted-foreground">Sócios mais ativos do Clube.</p>
          {loadingUsers ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            usersRanking?.map((p, idx) => {
              const isMe = p.user_id === user?.id;
              const initial = p.full_name.charAt(0).toUpperCase();
              return (
                <Card key={p.user_id} className={`p-3 flex items-center gap-3 ${isMe ? 'ring-2 ring-accent' : ''}`}>
                  <span className="w-6 text-center font-bold text-muted-foreground text-sm">{idx + 1}º</span>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.full_name}{isMe && ' (você)'}</p>
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${tierColor(p.tier)} text-white font-medium`}>
                      {p.tier}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{p.points}</p>
                    <p className="text-[10px] text-muted-foreground">pontos</p>
                  </div>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserBatalhaRanking;
