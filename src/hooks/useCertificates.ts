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
  student_cpf?: string;
  student_name?: string;
  workload_seconds?: number;
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

function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `***.***. ${digits.slice(6, 9)}-${digits.slice(9)}`;
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

async function fetchWorkloadSeconds(certificateType: string, referenceId: string): Promise<number> {
  if (certificateType === 'module') {
    // Sum duration_seconds of all lessons in this package
    const { data } = await supabase
      .from('recipe_packages')
      .select('recipe_id, recipes(duration_seconds)')
      .eq('package_id', referenceId);
    return (data || []).reduce((sum, rp) => sum + ((rp.recipes as any)?.duration_seconds || 0), 0);
  } else if (certificateType === 'course') {
    // Sum from all packages in this course
    const { data: pkgs } = await supabase
      .from('course_packages')
      .select('package_id')
      .eq('course_id', referenceId);
    const packageIds = (pkgs || []).map(p => p.package_id);
    if (packageIds.length === 0) return 0;
    const { data } = await supabase
      .from('recipe_packages')
      .select('recipe_id, recipes(duration_seconds)')
      .in('package_id', packageIds);
    // Deduplicate by recipe_id
    const seen = new Set<string>();
    return (data || []).reduce((sum, rp) => {
      if (seen.has(rp.recipe_id)) return sum;
      seen.add(rp.recipe_id);
      return sum + ((rp.recipes as any)?.duration_seconds || 0);
    }, 0);
  } else {
    // Combo: sum from all courses in this combo
    const { data: courses } = await supabase
      .from('combo_courses')
      .select('course_id')
      .eq('combo_id', referenceId);
    const courseIds = (courses || []).map(c => c.course_id);
    if (courseIds.length === 0) return 0;
    const { data: pkgs } = await supabase
      .from('course_packages')
      .select('package_id')
      .in('course_id', courseIds);
    const packageIds = (pkgs || []).map(p => p.package_id);
    if (packageIds.length === 0) return 0;
    const { data } = await supabase
      .from('recipe_packages')
      .select('recipe_id, recipes(duration_seconds)')
      .in('package_id', packageIds);
    const seen = new Set<string>();
    return (data || []).reduce((sum, rp) => {
      if (seen.has(rp.recipe_id)) return sum;
      seen.add(rp.recipe_id);
      return sum + ((rp.recipes as any)?.duration_seconds || 0);
    }, 0);
  }
}

export const useGenerateCertificate = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      certificateType,
      referenceId,
      referenceName,
      completedAt,
      studentCpf,
    }: {
      certificateType: string;
      referenceId: string;
      referenceName: string;
      completedAt?: string;
      studentCpf: string;
    }) => {
      if (!user) throw new Error('Não autenticado');

      // Check if certificate already exists
      const { data: existing } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id)
        .eq('certificate_type', certificateType)
        .eq('reference_id', referenceId)
        .maybeSingle();

      let cert = existing as Certificate | null;
      const studentName = profile?.full_name || profile?.email || 'Aluno';

      // Fetch workload from lesson durations
      const totalSeconds = await fetchWorkloadSeconds(certificateType, referenceId);

      if (!cert) {
        const { data: newCert, error } = await supabase
          .from('certificates')
          .insert({
            user_id: user.id,
            certificate_type: certificateType,
            reference_id: referenceId,
            reference_name: referenceName,
            verification_code: generateVerificationCode(),
            completed_at: completedAt || new Date().toISOString(),
            student_cpf: studentCpf,
            student_name: studentName,
            workload_seconds: totalSeconds,
          })
          .select()
          .single();

        if (error) throw error;
        cert = newCert as Certificate;
      } else if (!cert.student_cpf || !cert.student_name || !cert.workload_seconds) {
        // Update existing certificate with missing data
        const updates: Record<string, any> = {};
        if (!cert.student_cpf) updates.student_cpf = studentCpf;
        if (!cert.student_name) updates.student_name = studentName;
        if (!cert.workload_seconds) updates.workload_seconds = totalSeconds;
        const { data: updated, error } = await supabase
          .from('certificates')
          .update(updates)
          .eq('id', cert.id)
          .select()
          .single();
        if (!error && updated) cert = updated as Certificate;
      }

      // Generate PDF
      await generatePDF(cert, studentName, certificateType, studentCpf, totalSeconds);

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

async function generatePDF(cert: Certificate, studentName: string, certificateType: string, cpf: string, totalSeconds: number) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Background
  doc.setFillColor(15, 15, 20);
  doc.rect(0, 0, w, h, 'F');

  // Border
  doc.setDrawColor(200, 170, 110);
  doc.setLineWidth(1.5);
  doc.rect(10, 10, w - 20, h - 20);
  doc.setLineWidth(0.5);
  doc.rect(13, 13, w - 26, h - 26);

  const centerX = w / 2;

  // Logo
  try {
    const { default: logoUrl } = await import('@/assets/logotipo-drinkeros.png');
    const logoBase64 = await loadImageAsBase64(logoUrl);
    doc.addImage(logoBase64, 'PNG', centerX - 20, 18, 40, 16);
  } catch (e) {
    console.warn('Could not load logo for certificate', e);
  }

  // Top accent line
  doc.setDrawColor(200, 170, 110);
  doc.setLineWidth(0.8);
  doc.line(centerX - 60, 38, centerX + 60, 38);

  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CERTIFICADO DE CONCLUSÃO', centerX, 52, { align: 'center' });

  // Decorative line
  doc.setDrawColor(200, 170, 110);
  doc.setLineWidth(0.8);
  doc.line(centerX - 60, 57, centerX + 60, 57);

  // Body text
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text('Certificamos que', centerX, 70, { align: 'center' });

  // Student name
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(studentName.toUpperCase(), centerX, 82, { align: 'center' });

  // CPF
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text(`CPF: ${maskCpf(cpf)}`, centerX, 89, { align: 'center' });

  // Line under name
  doc.setDrawColor(200, 170, 110);
  doc.setLineWidth(0.3);
  const nameWidth = doc.getTextWidth(studentName.toUpperCase());
  doc.line(centerX - nameWidth / 2 - 5, 92, centerX + nameWidth / 2 + 5, 92);

  // Type label
  const typeLabel =
    certificateType === 'module' ? 'o módulo' :
    certificateType === 'course' ? 'o curso' : 'o combo';

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(`concluiu com êxito ${typeLabel}`, centerX, 103, { align: 'center' });

  // Reference name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 170, 110);
  doc.text(cert.reference_name, centerX, 114, { align: 'center' });

  // Workload
  if (totalSeconds > 0) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    let workloadText = 'Carga horária: ';
    if (hours > 0 && minutes > 0) workloadText += `${hours}h ${minutes}min`;
    else if (hours > 0) workloadText += `${hours} hora${hours !== 1 ? 's' : ''}`;
    else workloadText += `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(workloadText, centerX, 122, { align: 'center' });
  }

  // Date
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  const dateY = totalSeconds > 0 ? 130 : 126;
  doc.text(`em ${formatDatePtBr(cert.completed_at)}`, centerX, dateY, { align: 'center' });

  // Bottom decorative line
  doc.setDrawColor(200, 170, 110);
  doc.setLineWidth(0.8);
  doc.line(centerX - 40, dateY + 10, centerX + 40, dateY + 10);

  // Verification code
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Código de verificação: ${cert.verification_code}`, centerX, h - 30, { align: 'center' });
  doc.text('Valide em: alunos.criminallab.com.br/validar-certificado', centerX, h - 24, { align: 'center' });

  doc.save(`Certificado - ${cert.reference_name}.pdf`);
}
