import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useFileUpload = (bucket: string) => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const upload = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const fileName = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      toast({
        title: 'Erro ao fazer upload do arquivo',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading };
};
