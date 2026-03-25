import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UpsellSettings {
  id: string;
  is_enabled: boolean;
  progress_threshold: number;
  cooldown_days: number;
  enrollment_days_trigger: number;
  whatsapp_enabled: boolean;
  whatsapp_template_name: string;
  updated_at: string;
}

export interface UpsellSequence {
  id: string;
  user_id: string;
  product_type: string;
  product_id: string;
  trigger_module_id: string | null;
  status: string;
  emails_sent: number;
  last_email_at: string | null;
  whatsapp_sent: number;
  last_whatsapp_at: string | null;
  ai_generated_subject: string | null;
  ai_generated_body: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsellEmailLog {
  id: string;
  sequence_id: string;
  step: number;
  subject: string | null;
  body_html: string | null;
  sent_at: string;
  status: string;
  channel: string;
}

export const useUpsellSettings = () => {
  return useQuery({
    queryKey: ['upsell-settings'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('upsell_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as UpsellSettings;
    },
  });
};

export const useUpdateUpsellSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: Partial<UpsellSettings> & { id: string }) => {
      const { id, ...updates } = settings;
      const { error } = await (supabase.from as any)('upsell_settings')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsell-settings'] });
      toast({ title: 'Configurações de upsell salvas' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpsellSequences = () => {
  return useQuery({
    queryKey: ['upsell-sequences'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('upsell_sequences')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as UpsellSequence[];
    },
  });
};

export const useUpsellEmailLogs = (sequenceId: string | null) => {
  return useQuery({
    queryKey: ['upsell-email-logs', sequenceId],
    queryFn: async () => {
      if (!sequenceId) return [];
      const { data, error } = await (supabase.from as any)('upsell_email_logs')
        .select('*')
        .eq('sequence_id', sequenceId)
        .order('step', { ascending: true });
      if (error) throw error;
      return data as UpsellEmailLog[];
    },
    enabled: !!sequenceId,
  });
};

export const useCancelUpsellSequence = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sequenceId: string) => {
      const { error } = await (supabase.from as any)('upsell_sequences')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', sequenceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsell-sequences'] });
      toast({ title: 'Sequência cancelada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cancelar', description: error.message, variant: 'destructive' });
    },
  });
};
