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

function generateVerificationCode(): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CRIM-${year}-${code}`;
}

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

      // Check if certificate already exists
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

      // Generate PDF with background image
      await generatePDF(cert, studentName, certificateBgUrl, textColor);

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

async function generatePDF(cert: Certificate, studentName: string, bgUrl: string, textColor: string = '#FFFFFF') {
  // Background image is 3347x2447 → landscape ratio
  const imgWidth = 3347;
  const imgHeight = 2447;

  // Create PDF with same aspect ratio (mm)
  const pdfWidth = 297; // A4 landscape width
  const pdfHeight = pdfWidth * (imgHeight / imgWidth);

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
    // Fallback: dark background
    doc.setFillColor(15, 15, 20);
    doc.rect(0, 0, pdfWidth, pdfHeight, 'F');
  }

  const centerX = pdfWidth / 2;

  // Parse hex color
  const h = textColor.replace('#', '');
  const cr = parseInt(h.substring(0, 2), 16);
  const cg = parseInt(h.substring(2, 4), 16);
  const cb = parseInt(h.substring(4, 6), 16);

  // Student name
  const nameY = pdfHeight * 0.545;
  doc.setFontSize(28);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(cr, cg, cb);
  doc.text(studentName, centerX, nameY, { align: 'center' });

  // Date — centered above the "Data" line at bottom left
  const dateY = pdfHeight * 0.77;
  const dateX = pdfWidth * 0.268;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(cr, cg, cb);
  doc.text(formatDatePtBr(cert.completed_at), dateX, dateY, { align: 'center' });

  doc.save(`Certificado - ${cert.reference_name}.pdf`);
}
