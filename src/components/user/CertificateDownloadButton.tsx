import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGenerateCertificate } from '@/hooks/useCertificates';

interface CertificateDownloadButtonProps {
  referenceId: string;
  referenceName: string;
  completedAt?: string;
  certificateBgUrl: string;
  textColor?: string;
}

const CertificateDownloadButton: React.FC<CertificateDownloadButtonProps> = ({
  referenceId,
  referenceName,
  completedAt,
  certificateBgUrl,
  textColor,
}) => {
  const { mutate, isPending } = useGenerateCertificate();

  const handleClick = () => {
    mutate({ referenceId, referenceName, completedAt, certificateBgUrl, textColor });
  };

  return (
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
      Baixar Certificado
    </Button>
  );
};

export default CertificateDownloadButton;
