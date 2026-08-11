import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FunnelEvent } from '@/lib/funnelTracking';

export type FunnelRange = 'today' | '7d' | '30d' | 'all';

const sinceFromRange = (range: FunnelRange): string | null => {
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

export interface FunnelCounts {
  pageview: number;
  offer_1_revealed: number;
  checkout_1_started: number;
  offer_2_revealed: number;
  checkout_2_started: number;
  subscription_confirmed: number;
}

const ZERO: FunnelCounts = {
  pageview: 0,
  offer_1_revealed: 0,
  checkout_1_started: 0,
  offer_2_revealed: 0,
  checkout_2_started: 0,
  subscription_confirmed: 0,
};

export interface FunnelSalesSource {
  productType: string;
  productSlug: string;
}

export const usePageFunnel = (
  pageKey: string,
  range: FunnelRange = '30d',
  salesSource?: FunnelSalesSource,
) => {
  return useQuery({
    queryKey: ['page-funnel', pageKey, range, salesSource?.productType, salesSource?.productSlug],
    enabled: !!pageKey,
    refetchInterval: 30_000,
    queryFn: async (): Promise<FunnelCounts> => {
      const since = sinceFromRange(range);
      const { data, error } = await supabase.rpc('get_page_funnel' as any, {
        _page_key: pageKey,
        _since: since,
      });
      if (error) throw error;
      const out: FunnelCounts = { ...ZERO };
      for (const row of (data ?? []) as Array<{ event: FunnelEvent; count: number }>) {
        if (row.event in out) {
          out[row.event as keyof FunnelCounts] = Number(row.count) || 0;
        }
      }

      // Etapa "Comprou": medida por vendas aprovadas no banco (fonte confiável),
      // e não por evento disparado no navegador.
      if (salesSource) {
        const { data: sales, error: salesError } = await supabase.rpc(
          'get_page_funnel_sales' as any,
          {
            _product_type: salesSource.productType,
            _product_slug: salesSource.productSlug,
            _since: since,
          },
        );
        if (salesError) {
          console.warn('[funnel] falha ao ler vendas do banco:', salesError.message);
        } else {
          out.subscription_confirmed = Number(sales) || 0;
        }
      }

      return out;
    },
  });
};

