import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CERTIFICATE_LAYOUT_DEFAULTS, CertificateLayoutValues } from '@/lib/certificatePdf';

export interface CertificateLayout extends CertificateLayoutValues {
  id: string;
}

const DEFAULTS = CERTIFICATE_LAYOUT_DEFAULTS;

export const useCertificateLayout = () => {
  return useQuery({
    queryKey: ['certificate-layout'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certificate_layout_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching certificate layout:', error);
        return DEFAULTS as CertificateLayout;
      }

      return (data as CertificateLayout) || (DEFAULTS as CertificateLayout);
    },
  });
};

export const useUpdateCertificateLayout = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (layout: Partial<CertificateLayout> & { id: string }) => {
      const { id, ...updates } = layout;
      const { error } = await supabase
        .from('certificate_layout_settings')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificate-layout'] });
      toast({ title: 'Posições salvas com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar posições', description: error.message, variant: 'destructive' });
    },
  });
};

export const CERT_DEFAULTS = DEFAULTS;
