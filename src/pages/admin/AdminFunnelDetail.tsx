import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageFunnel, type FunnelRange, type FunnelCounts } from '@/hooks/usePageFunnel';
import { getFunnel } from '@/lib/funnels';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  const { data: counts, isLoading } = usePageFunnel(funnel, range);


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

  const safe: FunnelCounts = counts ?? {};
  const get = (key: string) => safe[key] ?? 0;
  const steps = funnel.steps;
  const topCount = get(steps[0].key);
  const lastCount = get(steps[steps.length - 1].key);


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
              const count = get(s.key);
              const prev = idx === 0 ? null : get(steps[idx - 1].key);
              const widthPct = topCount > 0 ? Math.max(2, (count / topCount) * 100) : 2;
              return (
                <div key={s.key} className="space-y-1.5">
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
                <div key={s.key}>
                  <div className="text-xs text-muted-foreground truncate">
                    % {s.label.toLowerCase()}
                  </div>
                  <div className="text-xl font-bold">{pct(get(s.key), get(steps[i].key))}</div>
                </div>
              ))}
            </div>

            {funnel.productType && funnel.productSlug && (
              <p className="text-xs text-muted-foreground pt-2">
                As etapas de navegação são contadas por sessão na página. As etapas “Comprou por
                R$ 197” e “Comprou por R$ 97” são contadas pelos pagamentos aprovados do produto
                no banco, separados pelo valor pago — por isso podem incluir compras feitas por
                outros caminhos (ex.: link direto) e não dependem do cliente voltar para a página
                após pagar.
              </p>
            )}


          </div>
        )}
      </div>
      {funnel.key === 'rand' && <RandUpsellMetrics />}
    </div>
  );
};

const RandUpsellMetrics: React.FC = () => {
  const { data } = useQuery({
    queryKey: ['rand-upsell-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_purchase_offers' as any)
        .select('viewed_at, accepted_at, declined_at, checkout_started_at, paid_at, amount, events')
        .eq('offer_key', 'rand-pacote-business');
      if (error) throw error;
      return (data || []) as any[];
    },
  });
  const rows = data ?? [];
  const n = (k: string) => rows.filter((r) => r[k]).length;
  const revenue = rows.filter((r) => r.paid_at).reduce((s, r) => s + Number(r.amount || 0), 0);
  const e = (k: string) => rows.filter((r) => r.events && r.events[k]).length;
  const items = [
    ['Viu a página pós-compra', n('viewed_at')],
    ['Vídeo iniciado', e('video_start')],
    ['Vídeo 25%', e('video_25')],
    ['Vídeo 50%', e('video_50')],
    ['Vídeo 75%', e('video_75')],
    ['Vídeo 90%', e('video_90')],
    ['Vídeo completo', e('video_complete')],
    ['Oferta revelada (3:45)', e('offer_revealed')],
    ['Aceitou', e('accept')],
    ['Recusou', e('decline')],
    ['Iniciou o pagamento', e('checkout_started')],
    ['Upsell aprovado', e('paid')],
  ] as const;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Pós-compra: Pacote Business (R$ 97)</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map(([label, v]) => (
          <div key={label} className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{fmt(v)}</p>
          </div>
        ))}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Receita do upsell</p>
          <p className="text-2xl font-bold text-foreground">
            {revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminFunnelDetail;
