import React, { useMemo, useState } from 'react';
import {
  useBatalhaRanking,
  useMonthlyRanking,
  useClosedMonths,
  getCurrentMonthYearBRT,
  tierColor,
} from '@/hooks/useBatalha';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy, Loader2, Star, Crown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formatMonthYear = (my: string) => {
  const [y, m] = my.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

const shiftMonth = (my: string, delta: number): string => {
  const [y, m] = my.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const UserBatalhaRanking: React.FC = () => {
  const { user } = useAuth();
  const currentMy = getCurrentMonthYearBRT();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMy);

  const { data: ranking, isLoading } = useMonthlyRanking(selectedMonth);
  const { data: closedMonths } = useClosedMonths();
  const { data: usersRanking, isLoading: loadingUsers } = useBatalhaRanking();

  const isCurrent = selectedMonth === currentMy;
  // Limites: pode voltar até o mês mais antigo com registros; não pode passar do mês atual.
  const oldestMonth = useMemo(() => {
    const all = [currentMy, ...(closedMonths || [])];
    return all.sort()[0];
  }, [closedMonths, currentMy]);

  const canGoPrev = selectedMonth > oldestMonth;
  const canGoNext = selectedMonth < currentMy;

  return (
    <div className="container mx-auto max-w-2xl py-6 px-4 pb-24 md:pb-6 space-y-4">
      <div className="flex items-center gap-3">
        <Trophy className="h-6 w-6 text-yellow-500" />
        <h1 className="text-2xl font-bold">Ranking da Batalha</h1>
      </div>

      <Tabs defaultValue="mes" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="mes">Receitas</TabsTrigger>
          <TabsTrigger value="users">Sócios</TabsTrigger>
        </TabsList>

        {/* RECEITAS — mês vigente + navegação por meses anteriores */}
        <TabsContent value="mes" className="space-y-3 mt-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={!canGoPrev}
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold capitalize">{formatMonthYear(selectedMonth)}</p>
              <p className="text-[11px] text-muted-foreground">
                {isCurrent ? 'Em disputa neste mês' : 'Classificação encerrada'}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              disabled={!canGoNext}
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !ranking?.length ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">
              {isCurrent ? 'Nenhuma receita neste mês ainda.' : 'Não houve receitas neste mês.'}
            </Card>
          ) : (
            ranking.map((r, idx) => (
              <Link key={r.recipe_id} to={`/app/batalha/receita/${r.recipe_id}`}>
                <Card className={`p-3 flex items-center gap-3 hover:shadow-md transition-shadow ${!isCurrent && idx === 0 ? 'border-yellow-500/40' : ''}`}>
                  <span className="w-6 text-center font-bold text-muted-foreground text-sm flex flex-col items-center">
                    {!isCurrent && idx === 0 ? <Crown className="h-4 w-4 text-yellow-500" /> : `${idx + 1}º`}
                  </span>
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

          <p className="text-[11px] text-muted-foreground text-center pt-2">
            Toda virada de mês a classificação zera e uma nova disputa começa.
          </p>
        </TabsContent>

        {/* SÓCIOS — ranking de pontos */}
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
