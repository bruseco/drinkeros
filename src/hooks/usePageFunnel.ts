import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FunnelEvent } from '@/lib/funnelTracking';
import type { FunnelDef } from '@/lib/funnels';

import {funnelPeriodBounds,EMPTY_FUNNEL_DATES,type FunnelDates,type FunnelRange} from '@/lib/funnelPeriod';
export {sinceFromRange,type FunnelRange} from '@/lib/funnelPeriod';

/** Contagens por chave de etapa do funil. */
export type FunnelCounts = Record<string, number>;

export const usePageFunnel = (funnel: FunnelDef | undefined, range: FunnelRange = '30d', dates:FunnelDates=EMPTY_FUNNEL_DATES) => {
  return useQuery({
    queryKey: ['page-funnel', funnel?.key, range,dates.from,dates.to],
    enabled: !!funnel&&!!funnelPeriodBounds(range,dates),
    refetchInterval: 30_000,
    queryFn: async (): Promise<FunnelCounts> => {
      if (!funnel) return {};
      const bounds=funnelPeriodBounds(range,dates);
      if(!bounds)return {};
      const {since,until}=bounds;
      const out: FunnelCounts = {};
      for (const s of funnel.steps) out[s.key] = 0;

      // Etapas medidas por evento no navegador
      const { data, error } = await supabase.rpc((range==='custom'?'get_page_funnel_window':'get_page_funnel') as any, {
        _page_key: funnel.pageKey,
        _since: since,
        ...(range==='custom'?{_until:until}:{}),
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
            const { data: sales, error: salesError } = funnel.productType==='club'
              ? await supabase.rpc((funnel.abVariant?'get_club_ab_purchases':'get_club_purchase_funnel') as any,{_since:since,_until:until})
              : await supabase.rpc(
              (range==='custom'?'get_page_funnel_sales_window':'get_page_funnel_sales_range') as any,
              {
                _product_type: funnel.productType,
                _product_slug: funnel.productSlug,
                _since: since,
                _min_amount: s.sales?.min ?? null,
                _max_amount: s.sales?.max ?? null,
                ...(range==='custom'?{_until:until}:{}),
              },
            );
            if (salesError) {
              throw salesError;
            }
            out[s.key] = funnel.abVariant ? Number((sales as any[])?.find(row=>row.variant===funnel.abVariant)?.purchases)||0 : Number(sales) || 0;
          }),
        );
      }

      return out;
    },
  });
};
