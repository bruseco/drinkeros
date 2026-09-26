import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FunnelEvent } from '@/lib/funnelTracking';
import type { FunnelDef } from '@/lib/funnels';

export type FunnelRange = 'today' | '7d' | '30d' | 'all';

export const sinceFromRange = (range: FunnelRange): string | null => {
  const now = Date.now();
  switch (range) {
    case 'today': {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case '7d':
      return new Date(now - 7 * 86_400_000).toISOString();
    case '30d':
      return new Date(now - 30 * 86_400_000).toISOString();
    case 'all':
    default:
      return null;
  }
};

/** Contagens por chave de etapa do funil. */
export type FunnelCounts = Record<string, number>;

export const usePageFunnel = (funnel: FunnelDef | undefined, range: FunnelRange = '30d') => {
  return useQuery({
    queryKey: ['page-funnel', funnel?.key, range],
    enabled: !!funnel,
    refetchInterval: 30_000,
    queryFn: async (): Promise<FunnelCounts> => {
      if (!funnel) return {};
      const since = sinceFromRange(range);
      const out: FunnelCounts = {};
      for (const s of funnel.steps) out[s.key] = 0;

      // Etapas medidas por evento no navegador
      const { data, error } = await supabase.rpc('get_page_funnel' as any, {
        _page_key: funnel.pageKey,
        _since: since,
      });
      if (error) throw error;
      const byEvent = new Map<string, number>();
      for (const row of (data ?? []) as Array<{ event: FunnelEvent; count: number }>) {
        byEvent.set(row.event, Number(row.count) || 0);
      }
      for (const s of funnel.steps) {
        if (s.event) out[s.key] = byEvent.get(s.event) ?? 0;
      }

      // Etapas medidas por vendas aprovadas no banco (fonte confiável)
      const salesSteps = funnel.steps.filter((s) => s.sales);
      if (salesSteps.length && funnel.productType && funnel.productSlug) {
        await Promise.all(
          salesSteps.map(async (s) => {
            const { data: sales, error: salesError } = await supabase.rpc(
              'get_page_funnel_sales_range' as any,
              {
                _product_type: funnel.productType,
                _product_slug: funnel.productSlug,
                _since: since,
                _min_amount: s.sales?.min ?? null,
                _max_amount: s.sales?.max ?? null,
              },
            );
            if (salesError) {
              console.warn('[funnel] falha ao ler vendas do banco:', salesError.message);
              return;
            }
            out[s.key] = Number(sales) || 0;
          }),
        );
      }

      return out;
    },
  });
};
