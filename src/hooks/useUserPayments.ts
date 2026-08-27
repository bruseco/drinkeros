import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserPaymentRow {
  id: string;            // composite: e.g. "vip:<uuid>" / "course:<uuid>"
  table: 'vip_payments' | 'user_courses' | 'user_combos' | 'user_ebooks' | 'user_packages';
  rawId: string;
  product_type: 'clube' | 'curso' | 'combo' | 'ebook' | 'pacote';
  product_name: string;
  amount: number | null;
  currency: string;
  source: 'stripe' | 'mercadopago' | 'manual' | 'import' | 'vip_bonus' | string;
  payment_method: string | null;
  status: 'paid' | 'refunded' | 'pending' | 'failed' | string;
  paid_at: string | null;
  external_ref: string | null;
  refunded_at: string | null;
}

const sourceFromMeta = (row: any): string => {
  if (row?.metadata?.source === 'mercadopago') return 'mercadopago';
  if (row?.metadata?.mercadopago_payment_id) return 'mercadopago';
  if (row?.stripe_payment_intent_id || row?.stripe_charge_id || row?.stripe_invoice_id || row?.stripe_subscription_id) return 'stripe';
  return 'manual';
};

export const useUserPayments = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user-payments', userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserPaymentRow[]> => {
      const [vip, courses, combos, ebooks, packs] = await Promise.all([
        (supabase as any).from('vip_payments').select('*').eq('user_id', userId),
        (supabase as any).from('user_courses').select('*, courses(name)').eq('user_id', userId).eq('source', 'mercadopago'),
        (supabase as any).from('user_combos').select('*, combos(name)').eq('user_id', userId).eq('source', 'mercadopago'),
        (supabase as any).from('user_ebooks').select('*, ebooks(name)').eq('user_id', userId).eq('source', 'mercadopago'),
        (supabase as any).from('user_packages').select('*, packages(name)').eq('user_id', userId).eq('source', 'mercadopago'),
      ]);

      const rows: UserPaymentRow[] = [];

      (vip.data || []).forEach((p: any) => {
        const src = sourceFromMeta(p);
        // Stripe foi descontinuado na Drinkeros: cobranças antigas não entram nos relatórios
        if (src === 'stripe') return;
        rows.push({
          id: `vip:${p.id}`,
          table: 'vip_payments',
          rawId: p.id,
          product_type: 'clube',
          product_name: 'Clube dos Drinkeros',
          amount: p.amount != null ? Number(p.amount) : null,
          currency: p.currency || 'BRL',
          source: src,
          payment_method: p.payment_method,
          status: p.status,
          paid_at: p.paid_at,
          external_ref: p.stripe_payment_intent_id || p.stripe_charge_id || p.metadata?.mercadopago_payment_id || null,
          refunded_at: p.refunded_at,
        });
      });

      const pushItem = (
        list: any[] | null,
        table: UserPaymentRow['table'],
        product_type: UserPaymentRow['product_type'],
        nameKey: string
      ) => {
        (list || []).forEach((r: any) => {
          // Apenas pagamentos REAIS: precisam ter referência externa própria
          // (acessos propagados de cursos para módulos/combos não têm payment id)
          const hasOwnPayment = !!r.mercadopago_payment_id;
          if (!hasOwnPayment) return;
          rows.push({
            id: `${product_type}:${r.id}`,
            table,
            rawId: r.id,
            product_type,
            product_name: r[nameKey]?.name || '—',
            amount: r.amount != null ? Number(r.amount) : null,
            currency: r.currency || 'BRL',
            source: r.source,
            payment_method: null,
            status: r.refunded_at ? 'refunded' : 'paid',
            paid_at: r.purchased_at,
            external_ref: r.mercadopago_payment_id || null,
            refunded_at: r.refunded_at,
          });
        });
      };

      pushItem(courses.data, 'user_courses', 'curso', 'courses');
      pushItem(combos.data, 'user_combos', 'combo', 'combos');
      pushItem(ebooks.data, 'user_ebooks', 'ebook', 'ebooks');
      pushItem(packs.data, 'user_packages', 'pacote', 'packages');

      rows.sort((a, b) => {
        const da = a.paid_at ? new Date(a.paid_at).getTime() : 0;
        const db = b.paid_at ? new Date(b.paid_at).getTime() : 0;
        return db - da;
      });
      return rows;
    },
  });
};

export const useRefundPayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ table, recordId }: { table: UserPaymentRow['table']; recordId: string; userId: string }) => {
      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: { table, recordId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao processar estorno');
      return data;
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['user-payments', vars.userId] });
      toast({
        title: 'Estorno processado',
        description: `Provedor: ${data.provider} • R$ ${Number(data.refund_amount).toFixed(2)}`,
      });
    },
    onError: (e: any) => toast({ title: 'Erro ao estornar', description: e.message, variant: 'destructive' }),
  });
};
