import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  CERTIFICATE_LAYOUT_DEFAULTS,
  CertificateLayoutValues,
  downloadCertificatePdf,
} from '@/lib/certificatePdf';

interface Certificate {
  id: string;
  user_id: string;
  certificate_type: string;
  reference_id: string;
  reference_name: string;
  verification_code: string;
  completed_at: string;
  created_at: string;
  student_name?: string;
}


export const useCertificates = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['certificates', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data as Certificate[];
    },
    enabled: !!user,
  });
};

async function fetchLayout(): Promise<CertificateLayoutValues> {
  try {
    const { data, error } = await supabase
      .from('certificate_layout_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) return CERTIFICATE_LAYOUT_DEFAULTS;
    return {
      name_x: data.name_x,
      name_y: data.name_y,
      date_x: data.date_x,
      date_y: data.date_y,
      name_font_size: data.name_font_size,
      date_font_size: data.date_font_size,
    };
  } catch {
    return CERTIFICATE_LAYOUT_DEFAULTS;
  }
}

export const useGenerateCertificate = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      referenceId,
      referenceName,
      completedAt,
      certificateBgUrl,
      textColor = '#FFFFFF',
    }: {
      referenceId: string;
      referenceName: string;
      completedAt?: string;
      certificateBgUrl: string;
      textColor?: string;
    }) => {
      if (!user) throw new Error('Não autenticado');

      const studentName = profile?.full_name || profile?.email || 'Aluno';

      const { data: existing } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id)
        .eq('certificate_type', 'course')
        .eq('reference_id', referenceId)
        .maybeSingle();

      let cert = existing as Certificate | null;

      if (!cert) {
        const { data: newCert, error } = await supabase.rpc('issue_course_certificate', {
          _reference_id: referenceId,
          _reference_name: referenceName,
        });

        if (error) {
          const msg = error.message || '';
          if (msg.includes('course_not_completed')) {
            throw new Error('Conclua todas as aulas do curso para emitir o certificado.');
          }
          if (msg.includes('no_course_access')) {
            throw new Error('Você não tem acesso a este curso.');
          }
          throw error;
        }
        cert = newCert as unknown as Certificate;
      }


      const layout = await fetchLayout();
      await downloadCertificatePdf({
        backgroundUrl: certificateBgUrl,
        studentName,
        completedAt: cert.completed_at,
        referenceName: cert.reference_name,
        textColor,
        layout,
      });

      return cert;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      toast({ title: 'Certificado gerado com sucesso!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao gerar certificado',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
