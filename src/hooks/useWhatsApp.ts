import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WhatsAppConversation {
  id: string;
  phone: string;
  profile_id: string | null;
  contact_name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
  agent_mode: string;
  escalation_reason: string | null;
  escalated_at: string | null;
  zapi_connection_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZapiConnection {
  id: string;
  name: string;
  phone_number: string;
  provider: string;
  is_active: boolean;
  connection_status: string;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  direction: string;
  message_type: string;
  content: string | null;
  zapi_message_id: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface WhatsAppAgentSettings {
  id: string;
  is_enabled: boolean;
  system_prompt: string;
  escalation_keywords: string[];
  auto_reply_delay_seconds: number;
  max_messages_per_conversation: number;
  business_context: string;
  updated_at: string;
}

export function useConversations(filter: 'all' | 'open' | 'closed' | 'ai' | 'human' | 'unanswered' = 'all', search = '', limit = 50) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['whatsapp-conversations', filter, search, limit],
    queryFn: async () => {
      let q = (supabase.from as any)('whatsapp_conversations')
        .select('*', { count: 'exact' })
        .order('last_message_at', { ascending: false })
        .limit(limit);

      if (filter === 'unanswered') {
        q = q.eq('last_message_direction', 'inbound').eq('status', 'open');
      } else if (filter === 'ai' || filter === 'human') {
        q = q.eq('agent_mode', filter);
      } else if (filter !== 'all') {
        q = q.eq('status', filter);
      }
      if (search) {
        q = q.or(`phone.ilike.%${search}%,contact_name.ilike.%${search}%`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { conversations: (data || []) as WhatsAppConversation[], count: count as number | null };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-conversations-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_conversations',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'], refetchType: 'active' });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return {
    ...query,
    conversations: query.data?.conversations || [],
    count: query.data?.count ?? null,
  };
}

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['whatsapp-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`whatsapp-messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', conversationId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  return query;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ phone, message, conversationId, template, templateParams, mediaUrl, mediaType, fileName }: { phone: string; message?: string; conversationId?: string; template?: string; templateParams?: string[]; mediaUrl?: string; mediaType?: 'image' | 'audio' | 'document'; fileName?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('whatsapp-send', {
        body: { phone, message, conversationId, template, templateParams, mediaUrl, mediaType, fileName },
      });

      // Extract the real error message from the response body
      if (res.error) {
        const bodyError = res.data?.error || res.error.message;
        throw new Error(bodyError);
      }
      return res.data;
    },
    onMutate: async (params) => {
      if (!params.conversationId) return {};
      await queryClient.cancelQueries({ queryKey: ['whatsapp-messages', params.conversationId] });
      const previous = queryClient.getQueryData(['whatsapp-messages', params.conversationId]);
      const tempMsg: WhatsAppMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: params.conversationId,
        direction: 'outbound',
        message_type: params.mediaUrl ? (params.mediaType || 'image') : params.template ? 'template' : 'text',
        content: params.message || params.mediaUrl || (params.template ? `[Template: ${params.template}]` : null),
        status: 'sending',
        zapi_message_id: null,
        metadata: null,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData(['whatsapp-messages', params.conversationId], (old: WhatsAppMessage[] | undefined) => [...(old || []), tempMsg]);
      return { previous, conversationId: params.conversationId };
    },
    onError: (err: Error, _vars, context: any) => {
      if (context?.conversationId && context?.previous) {
        queryClient.setQueryData(['whatsapp-messages', context.conversationId], context.previous);
      }
      toast.error(`Erro ao enviar: ${err.message}`);
    },
    onSettled: (_data, _err, vars) => {
      if (vars.conversationId) {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', vars.conversationId] });
      }
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useCallback(async (conversationId: string) => {
    await (supabase.from as any)('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);
    queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
  }, [queryClient]);
}

export function useUpdateAgentMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, agentMode }: { conversationId: string; agentMode: 'ai' | 'human' }) => {
      const updates: any = { agent_mode: agentMode };
      if (agentMode === 'ai') {
        updates.escalation_reason = null;
        updates.escalated_at = null;
      }
      const { error } = await (supabase.from as any)('whatsapp_conversations')
        .update(updates)
        .eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Modo atualizado');
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}

export function useConnections() {
  return useQuery({
    queryKey: ['zapi-connections-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zapi_connections')
        .select('id, name, phone_number, provider, is_active, connection_status')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as ZapiConnection[];
    },
  });
}

export function useUpdateConversationConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, connectionId }: { conversationId: string; connectionId: string | null }) => {
      const { error } = await (supabase.from as any)('whatsapp_conversations')
        .update({ zapi_connection_id: connectionId })
        .eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Conexão da conversa atualizada');
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}

export function useAgentSettings() {
  return useQuery({
    queryKey: ['whatsapp-agent-settings'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('whatsapp_agent_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as WhatsAppAgentSettings;
    },
  });
}

export function useUpdateAgentSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<WhatsAppAgentSettings> & { id: string }) => {
      const { id, ...updates } = settings;
      const { error } = await (supabase.from as any)('whatsapp_agent_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-agent-settings'] });
      toast.success('Configurações do agente salvas');
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}
