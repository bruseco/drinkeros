import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VipPayment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_invoice_id: string | null;
  stripe_subscription_id: string | null;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  created_at: string;
}

export const useVipPayments = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['vip-payments', userId],
    enabled: !!userId,
    queryFn: async (): Promise<VipPayment[]> => {
      const { data, error } = await (supabase as any)
        .from('vip_payments')
        .select('*')
        .eq('user_id', userId!)
        .order('paid_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as VipPayment[];
    },
  });
};

export const useCreateManualVipPayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      userId,
      amount,
      paymentMethod,
      paidAt,
      notes,
    }: {
      userId: string;
      amount: number;
      paymentMethod: string;
      paidAt: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from('vip_payments').insert({
        user_id: userId,
        amount,
        currency: 'BRL',
        status: 'paid',
        payment_method: paymentMethod,
        paid_at: paidAt,
        notes,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['vip-payments', vars.userId] });
      toast({ title: 'Pagamento registrado' });
    },
    onError: (e: any) => toast({ title: 'Erro ao registrar pagamento', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteVipPayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id }: { id: string; userId: string }) => {
      const { error } = await (supabase as any).from('vip_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['vip-payments', vars.userId] });
      toast({ title: 'Pagamento removido' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });
};
