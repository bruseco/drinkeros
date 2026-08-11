import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageFunnel, type FunnelRange, type FunnelCounts } from '@/hooks/usePageFunnel';
import { getFunnel } from '@/lib/funnels';

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

const RANGE_LABELS: Array<{ value: FunnelRange; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: 'Tudo' },
];

const fmt = (n: number) => n.toLocaleString('pt-BR');
const pct = (n: number, base: number) => (base > 0 ? `${((n / base) * 100).toFixed(1)}%` : '—');

const AdminFunnelDetail: React.FC = () => {
  const { funnelKey } = useParams<{ funnelKey: string }>();
  const funnel = getFunnel(funnelKey ?? '');
  const [range, setRange] = useState<FunnelRange>('30d');
  const { data: counts, isLoading } = usePageFunnel(funnel?.pageKey ?? '', range);

  if (!funnel) {
    return (
      <div className="space-y-4">
        <Link to="/admin/funis" className="text-sm text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <p className="text-muted-foreground">Funil não encontrado.</p>
      </div>
    );
  }

  const safe: FunnelCounts = counts ?? {
    pageview: 0, offer_1_revealed: 0, checkout_1_started: 0,
    offer_2_revealed: 0, checkout_2_started: 0, subscription_confirmed: 0,
  };
  const steps = funnel.steps;
  const topCount = safe[steps[0].event as keyof FunnelCounts];
  const lastCount = safe[steps[steps.length - 1].event as keyof FunnelCounts];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/funis" className="text-sm text-primary inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="h-3 w-3" /> Voltar para os funis
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{funnel.name}</h1>
            <a
              href={funnel.publicPath}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary inline-flex items-center gap-1 hover:underline"
            >
              {ORIGIN}{funnel.publicPath} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex gap-1.5">
            {RANGE_LABELS.map((r) => (
              <Button
                key={r.value}
                size="sm"
                variant={range === r.value ? 'default' : 'outline'}
                onClick={() => setRange(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-5">
        {isLoading && !counts ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Carregando funil…</div>
        ) : topCount === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center space-y-2">
            <p>Ainda não há eventos registrados para este funil.</p>
            <p className="text-xs">
              Assim que visitantes acessarem <code>{funnel.publicPath}</code>, os números aparecem aqui
              (atualiza a cada 30s).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((s, idx) => {
              const count = safe[s.event as keyof FunnelCounts];
              const prev = idx === 0 ? null : safe[steps[idx - 1].event as keyof FunnelCounts];
              const widthPct = topCount > 0 ? Math.max(2, (count / topCount) * 100) : 2;
              return (
                <div key={s.event} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium truncate">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                      {prev !== null && <span>↘ {pct(count, prev)}</span>}
                      <span className="text-foreground font-semibold text-base">{fmt(count)}</span>
                    </div>
                  </div>
                  <div className="relative h-9 rounded-md bg-muted/40 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3 text-xs text-foreground/80">
                      {pct(count, topCount)} do topo
                      {s.hint && (
                        <span className="ml-auto text-muted-foreground hidden sm:inline">{s.hint}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-4 mt-2 border-t grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Conversão total</div>
                <div className="text-xl font-bold">{pct(lastCount, topCount)}</div>
              </div>
              {steps.slice(1).map((s, i) => (
                <div key={s.event}>
                  <div className="text-xs text-muted-foreground truncate">
                    % {s.label.toLowerCase()}
                  </div>
                  <div className="text-xl font-bold">
                    {pct(
                      safe[s.event as keyof FunnelCounts],
                      safe[steps[i].event as keyof FunnelCounts],
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFunnelDetail;
