import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { funnelPeriodBounds, type FunnelDates, type FunnelRange } from '@/lib/funnelPeriod';
import { PROFILES } from '@/lib/quizLegacyLogic';

type Counts = { destination: string; clicks: number; landing_views: number; checkout_views: number };
const targets = [...new Map(Object.values(PROFILES).map(p => [p.path, p.product])).entries()];
const fmt = (n: number) => Number(n).toLocaleString('pt-BR');
export default function QuizDestinationMetrics({ range, dates }: { range: FunnelRange; dates: FunnelDates }) {
  const bounds = funnelPeriodBounds(range, dates);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['quiz-destinations', range, dates.from, dates.to], enabled: !!bounds, refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_quiz_destination_metrics' as never, { _since: bounds?.since, _until: bounds?.until } as never);
      if (error) throw error;
      return (data ?? []) as Counts[];
    },
  });
  return <section className="space-y-4" aria-labelledby="quiz-destinations-heading">
    <div><h2 id="quiz-destinations-heading" className="text-xl font-semibold">Do quiz até o checkout</h2>
      <p className="text-sm text-muted-foreground">Destino indicado pelo quiz e continuidade na mesma sessão. O período seleciona os cliques de saída; acompanhamos a navegação por até duas horas, dentro do fim do período.</p></div>
    {isError ? <p role="alert" className="text-destructive">Não foi possível carregar os destinos do quiz.</p> : isLoading ? <p>Carregando destinos…</p> : <div className="grid gap-4 lg:grid-cols-2">{targets.map(([path, product]) => {
      const row = data?.find(r => r.destination === path);
      const clicks = Number(row?.clicks ?? 0), views = Number(row?.landing_views ?? 0), checkouts = Number(row?.checkout_views ?? 0);
      return <article key={path} className="rounded-xl border p-5 space-y-3">
        <div><h3 className="font-semibold">{product}</h3><a href={path} target="_blank" rel="noopener noreferrer" className="text-xs text-primary break-all">{path}</a></div>
        <dl className="grid grid-cols-3 gap-3 text-sm">{[['Clicou para a landing', clicks], ['Chegou à landing', views], ['Chegou ao checkout', checkouts]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-xl font-semibold">{fmt(Number(value))}</dd></div>)}</dl>
        <p className="text-xs text-muted-foreground">Landing → checkout: {views ? `${(checkouts / views * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}</p>
      </article>;
    })}</div>}
    <p className="text-xs text-muted-foreground">Chegadas à landing e ao checkout começam a ser medidas após a publicação deste ajuste. Cliques antigos podem ter destino identificado pelo perfil, mas não comprovam a continuidade da visita. Checkout não significa compra aprovada.</p>
  </section>;
}
