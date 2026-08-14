import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Sparkles, ShoppingCart, Crown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageFunnel, type FunnelRange, type FunnelCounts } from '@/hooks/usePageFunnel';

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

// Resolve path público da pageKey (best effort)
const pathFromPageKey = (pageKey: string): string => {
  if (pageKey === 'clube') return '/pv-clube';
  if (pageKey === 'clube-b') return '/pv-clube-b';
  // Para courses/ebooks o pageKey carrega o id; mostrar pageKey cru.
  return `/${pageKey}`;
};

interface Step {
  key: keyof FunnelCounts;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  amount?: number; // R$
  hint?: string;
}

const CLUB_STEPS: Step[] = [
  { key: 'pageview', label: 'PageViews', icon: Eye, hint: 'Pessoas que abriram a página' },
  { key: 'offer_1_revealed', label: '1ª Oferta revelada (R$97/ano)', icon: Sparkles, amount: 97 },
  { key: 'checkout_1_started', label: '1º Checkout iniciado', icon: ShoppingCart, amount: 97 },
  { key: 'offer_2_revealed', label: '2ª Oferta revelada (R$47/ano)', icon: Sparkles, amount: 47 },
  { key: 'checkout_2_started', label: '2º Checkout iniciado', icon: ShoppingCart, amount: 47 },
  { key: 'subscription_confirmed', label: 'Assinaturas confirmadas', icon: Crown },
];

const SIMPLE_STEPS: Step[] = [
  { key: 'pageview', label: 'PageViews', icon: Eye },
  { key: 'checkout_1_started', label: 'Checkout iniciado', icon: ShoppingCart },
  { key: 'subscription_confirmed', label: 'Compra confirmada', icon: Crown },
];

const RANGE_LABELS: Array<{ value: FunnelRange; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: 'Tudo' },
];

const fmt = (n: number) => n.toLocaleString('pt-BR');
const pct = (n: number, base: number) => (base > 0 ? `${((n / base) * 100).toFixed(1)}%` : '—');

const FunnelBar: React.FC<{
  step: Step;
  count: number;
  topCount: number;
  prevCount: number | null;
}> = ({ step, count, topCount, prevCount }) => {
  const widthPct = topCount > 0 ? Math.max(2, (count / topCount) * 100) : 2;
  const Icon = step.icon;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium truncate">{step.label}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          {prevCount !== null && <span>↘ {pct(count, prevCount)}</span>}
          <span className="text-foreground font-semibold text-base">{fmt(count)}</span>
        </div>
      </div>
      <div className="relative h-9 rounded-md bg-muted/40 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 transition-all"
          style={{ width: `${widthPct}%` }}
        />
        <div className="absolute inset-0 flex items-center px-3 text-xs text-foreground/80">
          {topCount > 0 ? `${((count / topCount) * 100).toFixed(1)}% do topo` : '—'}
          {step.hint && <span className="ml-auto text-muted-foreground hidden sm:inline">{step.hint}</span>}
        </div>
      </div>
    </div>
  );
};

const AdminSalesPage: React.FC = () => {
  const { productKey: rawProduct, pageKey: rawPage } = useParams<{ productKey: string; pageKey: string }>();
  const productKey = decodeURIComponent(rawProduct ?? '');
  const pageKey = decodeURIComponent(rawPage ?? '');
  const [range, setRange] = useState<FunnelRange>('30d');

  const isClube = pageKey === 'clube' || pageKey === 'clube-b';
  const steps = isClube ? CLUB_STEPS : SIMPLE_STEPS;

  const funnelDef = React.useMemo(
    () => ({
      key: pageKey,
      pageKey,
      name: pageKey,
      description: '',
      publicPath: pathFromPageKey(pageKey),
      steps: steps.map((s) => ({ key: String(s.key), event: s.key as any, label: s.label })),
    }),
    [pageKey, steps],
  );

  const { data: counts, isLoading } = usePageFunnel(pageKey ? funnelDef : undefined, range);

  const safeCounts: FunnelCounts = counts ?? {
    pageview: 0, offer_1_revealed: 0, checkout_1_started: 0,
    offer_2_revealed: 0, checkout_2_started: 0, subscription_confirmed: 0,
  };


  const topCount = safeCounts[steps[0].key];
  const publicPath = pathFromPageKey(pageKey);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/admin/paginas-venda/${encodeURIComponent(productKey)}`}
          className="text-sm text-primary inline-flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar para o produto
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Funil de {publicPath}</h1>
            <a
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary inline-flex items-center gap-1 hover:underline"
            >
              {ORIGIN}{publicPath} <ExternalLink className="h-3 w-3" />
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

      <div className="rounded-lg border p-5 space-y-4">
        {isLoading && !counts ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Carregando funil…</div>
        ) : topCount === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center space-y-2">
            <p>Ainda não há eventos de funil para esta página.</p>
            <p className="text-xs">Assim que visitantes acessarem <code>{publicPath}</code>, os números aparecem aqui (atualiza a cada 30s).</p>
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((s, idx) => {
              const c = safeCounts[s.key];
              const prev = idx === 0 ? null : safeCounts[steps[idx - 1].key];
              return (
                <FunnelBar key={s.key} step={s} count={c} topCount={topCount} prevCount={prev} />
              );
            })}
            <div className="pt-4 mt-2 border-t grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Conversão total</div>
                <div className="text-xl font-bold">{pct(safeCounts.subscription_confirmed, topCount)}</div>
              </div>
              {isClube && (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground">% chegou na 1ª oferta</div>
                    <div className="text-xl font-bold">{pct(safeCounts.offer_1_revealed, topCount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">% checkout R$97</div>
                    <div className="text-xl font-bold">{pct(safeCounts.checkout_1_started, safeCounts.offer_1_revealed)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">% checkout R$47</div>
                    <div className="text-xl font-bold">{pct(safeCounts.checkout_2_started, safeCounts.offer_2_revealed)}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSalesPage;
