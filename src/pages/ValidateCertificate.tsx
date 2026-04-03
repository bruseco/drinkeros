import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Search, Loader2, XCircle } from 'lucide-react';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';

function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatDatePtBr(dateStr: string): string {
  const date = new Date(dateStr);
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

function formatWorkload(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
  if (hours > 0) return `${hours} hora${hours !== 1 ? 's' : ''}`;
  return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
}

interface CertificateResult {
  reference_name: string;
  certificate_type: string;
  completed_at: string;
  verification_code: string;
  student_name: string;
  workload_seconds: number;
}

const ValidateCertificate: React.FC = () => {
  const [cpf, setCpf] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CertificateResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setNotFound(false);

    const cpfDigits = cpf.replace(/\D/g, '');
    const trimmedCode = code.trim().toUpperCase();

    const { data, error } = await supabase
      .from('certificates')
      .select('reference_name, certificate_type, completed_at, verification_code, student_name, workload_seconds')
      .eq('verification_code', trimmedCode)
      .eq('student_cpf', cpfDigits)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setResult({
      reference_name: data.reference_name,
      certificate_type: data.certificate_type,
      completed_at: data.completed_at,
      verification_code: data.verification_code,
      student_name: data.student_name || 'Aluno',
      workload_seconds: data.workload_seconds || 0,
    });
    setLoading(false);
  };

  const typeLabel = (t: string) =>
    t === 'module' ? 'Módulo' : t === 'course' ? 'Curso' : 'Combo';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src={drinkrosLogo} alt="Drinkeros" className="h-12" />
          <h1 className="text-2xl font-bold text-foreground">Validar Certificado</h1>
          <p className="text-sm text-muted-foreground text-center">
            Informe o CPF do aluno e o código de verificação para confirmar a autenticidade do certificado.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF do Aluno</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpfInput(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Código de Verificação</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CRIM-2026-XXXXXX"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Validar
              </Button>
            </form>
          </CardContent>
        </Card>

        {notFound && (
          <Card className="border-destructive">
            <CardContent className="pt-6 flex items-center gap-3">
              <XCircle className="h-6 w-6 text-destructive flex-shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Certificado não encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Verifique o CPF e o código de verificação e tente novamente.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="border-primary">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">Certificado Válido</CardTitle>
              </div>
              <CardDescription>Os dados abaixo confirmam a autenticidade deste certificado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Aluno</p>
                <p className="font-semibold text-foreground">{result.student_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conteúdo Concluído</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{result.reference_name}</p>
                  <Badge variant="secondary">{typeLabel(result.certificate_type)}</Badge>
                </div>
              </div>
              {result.workload_seconds > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Carga Horária</p>
                  <p className="font-semibold text-foreground">{formatWorkload(result.workload_seconds)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Data de Conclusão</p>
                <p className="font-semibold text-foreground">{formatDatePtBr(result.completed_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Código</p>
                <p className="font-mono text-sm text-muted-foreground">{result.verification_code}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ValidateCertificate;
