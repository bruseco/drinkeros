import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

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

interface CertificateLayout {
  name_x: number;
  name_y: number;
  date_x: number;
  date_y: number;
  name_font_size: number;
  date_font_size: number;
}

const LAYOUT_DEFAULTS: CertificateLayout = {
  name_x: 1674,
  name_y: 1334,
  date_x: 897,
  date_y: 1886,
  name_font_size: 28,
  date_font_size: 14,
};

// Background image dimensions (constant)
const IMG_W = 3347;
const IMG_H = 2447;

function formatDatePtBr(dateStr: string): string {

  const date = new Date(dateStr);
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
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

async function loadImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fetchLayout(): Promise<CertificateLayout> {
  try {
    const { data, error } = await supabase
      .from('certificate_layout_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) return LAYOUT_DEFAULTS;
    return {
      name_x: data.name_x,
      name_y: data.name_y,
      date_x: data.date_x,
      date_y: data.date_y,
      name_font_size: data.name_font_size,
      date_font_size: data.date_font_size,
    };
  } catch {
    return LAYOUT_DEFAULTS;
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
        const { data: newCert, error } = await supabase
          .from('certificates')
          .insert({
            user_id: user.id,
            certificate_type: 'course',
            reference_id: referenceId,
            reference_name: referenceName,
            verification_code: generateVerificationCode(),
            completed_at: completedAt || new Date().toISOString(),
            student_name: studentName,
          })
          .select()
          .single();

        if (error) throw error;
        cert = newCert as Certificate;
      }

      const layout = await fetchLayout();
      await generatePDF(cert, studentName, certificateBgUrl, textColor, layout);

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

async function generatePDF(
  cert: Certificate,
  studentName: string,
  bgUrl: string,
  textColor: string,
  layout: CertificateLayout,
) {
  // PDF dimensions based on image aspect ratio
  const pdfWidth = 297; // A4 landscape width in mm
  const pdfHeight = pdfWidth * (IMG_H / IMG_W);

  // Conversion: pixel → mm
  const pxToMmX = pdfWidth / IMG_W;
  const pxToMmY = pdfHeight / IMG_H;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [pdfWidth, pdfHeight],
  });

  // Load and draw background image
  try {
    const bgBase64 = await loadImageAsBase64(bgUrl);
    doc.addImage(bgBase64, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  } catch (e) {
    console.error('Could not load certificate background', e);
    doc.setFillColor(15, 15, 20);
    doc.rect(0, 0, pdfWidth, pdfHeight, 'F');
  }

  // Parse hex color
  const h = textColor.replace('#', '');
  const cr = parseInt(h.substring(0, 2), 16);
  const cg = parseInt(h.substring(2, 4), 16);
  const cb = parseInt(h.substring(4, 6), 16);

  // Student name — pixel coords → mm
  const nameXmm = layout.name_x * pxToMmX;
  const nameYmm = layout.name_y * pxToMmY;
  doc.setFontSize(layout.name_font_size);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(cr, cg, cb);
  doc.text(studentName, nameXmm, nameYmm, { align: 'center' });

  // Date — pixel coords → mm
  const dateXmm = layout.date_x * pxToMmX;
  const dateYmm = layout.date_y * pxToMmY;
  doc.setFontSize(layout.date_font_size);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(cr, cg, cb);
  doc.text(formatDatePtBr(cert.completed_at), dateXmm, dateYmm, { align: 'center' });

  doc.save(`Certificado - ${cert.reference_name}.pdf`);
}
