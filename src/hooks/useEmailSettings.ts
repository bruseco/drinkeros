import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EmailSettings {
  id: string;
  sender_email: string;
  sender_name: string;
  reply_to_email: string | null;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_body: string;
  description: string | null;
  available_variables: string[];
  created_at: string;
  updated_at: string;
}

export const useEmailSettings = () => {
  return useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      return data as EmailSettings;
    },
  });
};

export const useUpdateEmailSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: Partial<EmailSettings> & { id: string }) => {
      const { id, ...updates } = settings;
      const { data, error } = await supabase
        .from('email_settings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      toast({ title: 'Configurações salvas com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    },
  });
};

export const useEmailTemplates = () => {
  return useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('slug');

      if (error) throw error;
      return data as EmailTemplate[];
    },
  });
};

export const useUpdateEmailTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: Partial<EmailTemplate> & { id: string }) => {
      const { id, ...updates } = template;
      const { data, error } = await supabase
        .from('email_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: 'Template salvo com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar template', description: error.message, variant: 'destructive' });
    },
  });
};
