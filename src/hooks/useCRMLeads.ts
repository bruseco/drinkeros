import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CRMLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  funnel: string;
  product_name: string | null;
  product_id: string | null;
  product_type: string | null;
  sale_value: number | null;
  source: string;
  assigned_to: string | null;
  profile_id: string | null;
  recovery_url: string | null;
  metadata: Record<string, unknown> | null;
  lost_reason: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CRMLeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CRMLeadTask {
  id: string;
  lead_id: string;
  title: string;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  assigned_to: string | null;
  created_at: string;
}

export const CRM_STAGES = [
  { key: 'carrinho_abandonado_1', label: 'Carrinho Abandonado 1', color: 'bg-orange-500' },
  { key: 'carrinho_abandonado_2', label: 'Carrinho Abandonado 2', color: 'bg-orange-600' },
  { key: 'pix_nao_pago_1', label: 'PIX Não Pago 1', color: 'bg-yellow-500' },
  { key: 'pix_nao_pago_2', label: 'PIX Não Pago 2', color: 'bg-yellow-600' },
  { key: 'cartao_recusado', label: 'Cartão Recusado', color: 'bg-red-500' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-blue-500' },
  { key: 'oferta_alternativa', label: 'Oferta Alternativa', color: 'bg-purple-500' },
] as const;

export const PICO_VENDAS_STAGES = [
  { key: 'entrada_contato', label: 'Entrada de Contato', color: 'bg-green-500' },
  { key: 'convite_1', label: 'Convite 1', color: 'bg-blue-500' },
  { key: 'convite_2', label: 'Convite 2', color: 'bg-purple-500' },
  { key: 'oferta_enviada', label: 'Oferta Enviada', color: 'bg-orange-500' },
] as const;

export const ATENDIMENTO_STAGES = [
  { key: 'entrada_contato_atend', label: 'Entrada de Contato', color: 'bg-green-500' },
  { key: 'abrir_conversa', label: 'Abrir Conversa', color: 'bg-orange-500' },
  { key: 'contato_realizado', label: 'Contato Realizado', color: 'bg-blue-500' },
] as const;

export const ALL_STAGES = [...CRM_STAGES, ...PICO_VENDAS_STAGES, ...ATENDIMENTO_STAGES];

export const CLOSED_STAGES = ['convertido', 'perdido'] as const;

export function useCRMLeads(includesClosed = false, funnel?: string) {
  return useQuery({
    queryKey: ['crm-leads', includesClosed, funnel],
    refetchInterval: 60_000,
    queryFn: async () => {
      const allData: CRMLead[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;

      while (true) {
        let query = supabase
          .from('crm_leads')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1) as any;

        if (funnel) {
          query = query.eq('funnel', funnel);
        } else {
          query = query.or('funnel.eq.recovery,funnel.is.null');
        }

        if (!includesClosed) {
          query = query.not('stage', 'in', '(convertido,perdido)');
        }

        const { data, error } = await query;
        if (error) throw error;
        allData.push(...(data as CRMLead[]));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      return allData;
    },
  });
}

export function useCRMLeadDetail(leadId: string | null) {
  return useQuery({
    queryKey: ['crm-lead', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('id', leadId)
        .single();
      if (error) throw error;
      return data as CRMLead;
    },
    enabled: !!leadId,
  });
}

export function useCRMLeadActivities(leadId: string | null) {
  return useQuery({
    queryKey: ['crm-lead-activities', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('crm_lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CRMLeadActivity[];
    },
    enabled: !!leadId,
  });
}

export function useCRMLeadTasks(leadId: string | null) {
  return useQuery({
    queryKey: ['crm-lead-tasks', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('crm_lead_tasks')
        .select('*')
        .eq('lead_id', leadId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data as CRMLeadTask[];
    },
    enabled: !!leadId,
  });
}

export function useCRMTasksDueToday() {
  return useQuery({
    queryKey: ['crm-tasks-due-today'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from('crm_lead_tasks')
        .select('*')
        .eq('completed', false)
        .lte('due_date', today.toISOString());
      if (error) throw error;
      return data as CRMLeadTask[];
    },
  });
}

export function useCreateCRMLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Partial<CRMLead>) => {
      const { data, error } = await supabase
        .from('crm_leads')
        .insert(lead as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success('Lead criado com sucesso');
    },
    onError: (e: Error) => toast.error('Erro ao criar lead: ' + e.message),
  });
}

export function useUpdateCRMLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMLead> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_leads')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-lead', data.id] });
    },
    onError: (e: Error) => toast.error('Erro ao atualizar lead: ' + e.message),
  });
}

const STAGE_TO_PROCESS: Record<string, string> = {
  carrinho_abandonado_1: 'crm_recovery_carrinho_1',
  carrinho_abandonado_2: 'crm_recovery_carrinho_2',
  pix_nao_pago_1: 'crm_recovery_pix_1',
  pix_nao_pago_2: 'crm_recovery_pix_2',
  cartao_recusado: 'crm_recovery_cartao',
  convite_1: 'crm_pico_convite_1',
  contato_realizado: 'crm_atendimento_contato_realizado',
};

export function useUpdateLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage, userId }: { id: string; stage: string; userId?: string }) => {
      const { error: updateError } = await supabase
        .from('crm_leads')
        .update({
          stage,
          ...(stage === 'convertido' ? { converted_at: new Date().toISOString() } : {}),
        } as any)
        .eq('id', id);
      if (updateError) throw updateError;

      const stageLabel = ALL_STAGES.find(s => s.key === stage)?.label || stage;
      await supabase.from('crm_lead_activities').insert({
        lead_id: id,
        activity_type: 'stage_change',
        description: `Movido para: ${stageLabel}`,
        created_by: userId || null,
      } as any);

      // Auto-enqueue WhatsApp template for recovery stages
      const process = STAGE_TO_PROCESS[stage];
      if (process) {
        try {
          // Fetch lead details and operator name in parallel
          const [{ data: lead }, { data: operatorProfile }] = await Promise.all([
            supabase
              .from('crm_leads')
              .select('phone, name, product_name, recovery_url')
              .eq('id', id)
              .single(),
            supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', userId!)
              .maybeSingle(),
          ]);

            if (lead?.phone) {
              // For atendimento funnel, find the conversation's connection
              let conversationConnectionId: string | null = null;
              if (process === 'crm_atendimento_contato_realizado') {
                const { data: conv } = await supabase
                  .from('whatsapp_conversations')
                  .select('zapi_connection_id')
                  .eq('phone', lead.phone)
                  .order('last_message_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                conversationConnectionId = conv?.zapi_connection_id || null;
              }

              // Find active binding for this process
              let bindingsQuery = supabase
                .from('whatsapp_template_bindings')
                .select('template_name, connection_id, variable_map')
                .eq('process', process)
                .eq('is_active', true);

              // Filter by conversation's connection if available
              if (conversationConnectionId) {
                bindingsQuery = bindingsQuery.eq('connection_id', conversationConnectionId);
              }

              const { data: bindings } = await bindingsQuery;

            if (bindings && bindings.length > 0) {
              // Pick random binding for A/B testing
              const binding = bindings[Math.floor(Math.random() * bindings.length)];

              // Build template message placeholder for queue
              const varMap = binding.variable_map as Record<string, string> || {};
              const params: string[] = [];
              const varValues: Record<string, string> = {
                lead_name: lead.name || '',
                product_name: lead.product_name || '',
                recovery_url: lead.recovery_url || '',
                operator_name: operatorProfile?.full_name || '',
              };
              // Build params from variable_map order
              const sortedKeys = Object.keys(varMap).sort();
              for (const key of sortedKeys) {
                const source = varMap[key] as string;
                if (source.startsWith('static:')) {
                  params.push(source.slice(7));
                } else {
                  params.push(varValues[source] || '');
                }
              }

              await supabase.from('whatsapp_send_queue').insert({
                phone: lead.phone,
                message: `[Template: ${binding.template_name}] ${params.join(', ')}`,
                context_type: 'crm_recovery',
                context_data: {
                  lead_id: id,
                  template_name: binding.template_name,
                  template_variables: Object.fromEntries(
                    params.map((v, i) => [String(i + 1), v])
                  ),
                  connection_id: binding.connection_id,
                },
                priority: 8,
                zapi_connection_id: binding.connection_id,
              } as any);

              await supabase.from('crm_lead_activities').insert({
                lead_id: id,
                activity_type: 'whatsapp_queued',
                description: `Template "${binding.template_name}" enfileirado para envio`,
                created_by: userId || null,
              } as any);
            }
          }
        } catch (err) {
          console.error('Erro ao enfileirar WhatsApp automático:', err);
          // Don't throw - stage change already succeeded
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-lead'] });
      qc.invalidateQueries({ queryKey: ['crm-lead-activities'] });
    },
    onError: (e: Error) => toast.error('Erro ao mover lead: ' + e.message),
  });
}

export function useCreateCRMActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (activity: Partial<CRMLeadActivity>) => {
      const { error } = await supabase
        .from('crm_lead_activities')
        .insert(activity as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-lead-activities'] });
    },
    onError: (e: Error) => toast.error('Erro ao adicionar atividade: ' + e.message),
  });
}

export function useCreateCRMTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Partial<CRMLeadTask>) => {
      const { error } = await supabase
        .from('crm_lead_tasks')
        .insert(task as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-lead-tasks'] });
      qc.invalidateQueries({ queryKey: ['crm-tasks-due-today'] });
      toast.success('Tarefa criada');
    },
    onError: (e: Error) => toast.error('Erro ao criar tarefa: ' + e.message),
  });
}

export function useToggleCRMTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('crm_lead_tasks')
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-lead-tasks'] });
      qc.invalidateQueries({ queryKey: ['crm-tasks-due-today'] });
    },
  });
}
