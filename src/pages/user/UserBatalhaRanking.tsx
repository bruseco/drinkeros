import React, { useMemo, useState } from 'react';
import {
  useMonthlyRanking,
  useClosedMonths,
  getCurrentMonthYearBRT,
} from '@/hooks/useBatalha';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Loader2, Star, Crown, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const currentMy = getCurrentMonthYearBRT();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMy);

  const { data: ranking, isLoading } = useMonthlyRanking(selectedMonth);
  const { data: closedMonths } = useClosedMonths();

  const isCurrent = selectedMonth === currentMy;
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
        <div className="space-y-2">
          {ranking.map((r, idx) => (
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
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center pt-2">
        Toda virada de mês a classificação zera e uma nova disputa começa.
      </p>
    </div>
  );
};

export default UserBatalhaRanking;
