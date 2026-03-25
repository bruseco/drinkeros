import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useGenerateCertificate } from '@/hooks/useCertificates';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CertificateDownloadButtonProps {
  certificateType: 'module' | 'course' | 'combo';
  referenceId: string;
  referenceName: string;
  completedAt?: string;
}

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11;
}

function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

const CertificateDownloadButton: React.FC<CertificateDownloadButtonProps> = ({
  certificateType,
  referenceId,
  referenceName,
  completedAt,
}) => {
  const { mutate, isPending } = useGenerateCertificate();
  const { user } = useAuth();
  const [showCpfDialog, setShowCpfDialog] = useState(false);
  const [cpfInput, setCpfInput] = useState('');
  const [savingCpf, setSavingCpf] = useState(false);

  const handleClick = async () => {
    if (!user) return;

    // Check if user already has CPF
    const { data: profile } = await supabase
      .from('profiles')
      .select('cpf')
      .eq('user_id', user.id)
      .single();

    if (profile?.cpf) {
      // Has CPF, generate directly
      mutate({ certificateType, referenceId, referenceName, completedAt, studentCpf: profile.cpf });
    } else {
      // Show dialog to collect CPF
      setShowCpfDialog(true);
    }
  };

  const handleSaveCpf = async () => {
    if (!user || !isValidCpf(cpfInput)) {
      toast.error('Informe um CPF válido com 11 dígitos.');
      return;
    }

    const cpfDigits = cpfInput.replace(/\D/g, '');
    setSavingCpf(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cpf: cpfDigits })
        .eq('user_id', user.id);

      if (error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          toast.error('Este CPF já está cadastrado em outra conta.');
        } else {
          throw error;
        }
        return;
      }

      setShowCpfDialog(false);
      mutate({ certificateType, referenceId, referenceName, completedAt, studentCpf: cpfDigits });
    } catch (err: any) {
      toast.error('Erro ao salvar CPF: ' + err.message);
    } finally {
      setSavingCpf(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Certificado
      </Button>

      <Dialog open={showCpfDialog} onOpenChange={setShowCpfDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informe seu CPF</DialogTitle>
            <DialogDescription>
              Para emitir o certificado, precisamos do seu CPF. Este dado será salvo e não poderá ser alterado posteriormente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="cpf-input">CPF</Label>
            <Input
              id="cpf-input"
              value={cpfInput}
              onChange={(e) => setCpfInput(formatCpfInput(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCpfDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCpf} disabled={savingCpf || !isValidCpf(cpfInput)}>
              {savingCpf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar e Gerar Certificado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CertificateDownloadButton;
