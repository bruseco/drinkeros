import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminOrder {
  id: string;
  user_id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  product_type: 'curso' | 'ebook' | 'combo' | 'pacote' | 'clube';
  product_id: string | null;
  product_name: string;
  amount: number | null;
  currency: string | null;
  source: string;
  payment_method: string | null;
  purchased_at: string;
  external_ref: string | null;
  refunded_at: string | null;
  total_count: number;
}

export interface AdminOrdersFilters {
  search?: string;
  source?: string;
  productType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const useAdminOrders = (filters: AdminOrdersFilters) => {
  const pageSize = filters.pageSize ?? 50;
  const page = filters.page ?? 0;
  return useQuery({
    queryKey: ['admin-orders', filters],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_orders', {
        p_search: filters.search || null,
        p_source: filters.source || null,
        p_product_type: filters.productType || null,
        p_from: filters.from || null,
        p_to: filters.to || null,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });
      if (error) throw error;
      const rows = (data || []) as AdminOrder[];
      const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;
      return { rows, total };
    },
    staleTime: 30_000,
  });
};
