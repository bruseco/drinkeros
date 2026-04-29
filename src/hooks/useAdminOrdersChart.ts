import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminOrdersChartFilters {
  search?: string;
  source?: string;
  productType?: string;
  from?: string;
  to?: string;
}

export interface ChartPoint {
  date: string; // ISO date (YYYY-MM-DD)
  label: string; // formatted for axis
  count: number;
  revenue: number;
}

const fmtLabel = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export const useAdminOrdersChart = (filters: AdminOrdersChartFilters) => {
  return useQuery({
    queryKey: ['admin-orders-chart', filters],
    queryFn: async (): Promise<ChartPoint[]> => {
      const { data, error } = await (supabase as any).rpc('admin_orders', {
        p_search: filters.search || null,
        p_source: filters.source || null,
        p_product_type: filters.productType || null,
        p_from: filters.from || null,
        p_to: filters.to || null,
        p_limit: 5000,
        p_offset: 0,
      });
      if (error) throw error;
      const rows = (data || []) as Array<{ purchased_at: string; amount: number | null }>;

      // Aggregate by day
      const buckets = new Map<string, { count: number; revenue: number }>();
      rows.forEach((r) => {
        if (!r.purchased_at) return;
        const d = new Date(r.purchased_at);
        const key = d.toISOString().slice(0, 10);
        const cur = buckets.get(key) ?? { count: 0, revenue: 0 };
        cur.count += 1;
        cur.revenue += Number(r.amount ?? 0);
        buckets.set(key, cur);
      });

      // Build continuous range
      const from = filters.from ? new Date(filters.from) : null;
      const to = filters.to ? new Date(filters.to) : new Date();
      const start = from ?? (rows.length
        ? new Date(Math.min(...rows.map((r) => new Date(r.purchased_at).getTime())))
        : to);

      const points: ChartPoint[] = [];
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        const b = buckets.get(key) ?? { count: 0, revenue: 0 };
        points.push({ date: key, label: fmtLabel(cursor), count: b.count, revenue: b.revenue });
        cursor.setDate(cursor.getDate() + 1);
      }
      return points;
    },
    staleTime: 30_000,
  });
};
