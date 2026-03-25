import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TARGET_ASPECT_RATIO = 16 / 9;
const MAX_WIDTH = 1280; // Reduced from 1920 for smaller files
const IMAGE_QUALITY = 0.75; // Reduced from 0.9 for better compression

/**
 * Crops, resizes, and compresses an image to 16:9 aspect ratio
 * Uses WebP format for better compression when supported
 */
const optimizeImage = (file: File): Promise<{ blob: Blob; format: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const srcWidth = img.width;
      const srcHeight = img.height;
      const srcAspect = srcWidth / srcHeight;

      let cropWidth: number;
      let cropHeight: number;
      let cropX: number;
      let cropY: number;

      // Determine crop dimensions to achieve 16:9
      if (srcAspect > TARGET_ASPECT_RATIO) {
        // Image is wider than 16:9 - crop sides
        cropHeight = srcHeight;
        cropWidth = srcHeight * TARGET_ASPECT_RATIO;
        cropX = (srcWidth - cropWidth) / 2;
        cropY = 0;
      } else {
        // Image is taller than 16:9 - crop top/bottom
        cropWidth = srcWidth;
        cropHeight = srcWidth / TARGET_ASPECT_RATIO;
        cropX = 0;
        cropY = (srcHeight - cropHeight) / 2;
      }

      // Calculate output dimensions (max width for smaller files)
      const outputWidth = Math.min(cropWidth, MAX_WIDTH);
      const outputHeight = outputWidth / TARGET_ASPECT_RATIO;

      // Create canvas and draw cropped/resized image
      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,  // Source rectangle
        0, 0, outputWidth, outputHeight        // Destination rectangle
      );

      // Try WebP first (better compression), fallback to JPEG
      const tryFormat = (format: string, quality: number): Promise<Blob | null> => {
        return new Promise((res) => {
          canvas.toBlob(
            (blob) => res(blob),
            format,
            quality
          );
        });
      };

      // Attempt WebP, then JPEG
      tryFormat('image/webp', IMAGE_QUALITY).then((webpBlob) => {
        if (webpBlob && webpBlob.size > 0) {
          resolve({ blob: webpBlob, format: 'webp' });
        } else {
          // Fallback to JPEG
          tryFormat('image/jpeg', IMAGE_QUALITY).then((jpegBlob) => {
            if (jpegBlob) {
              resolve({ blob: jpegBlob, format: 'jpg' });
            } else {
              reject(new Error('Failed to create image blob'));
            }
          });
        }
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

export const useImageUpload = (bucket: 'recipe-images' | 'package-covers') => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const upload = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      // GIF animado: upload direto, sem canvas, preserva animação
      if (file.type === 'image/gif') {
        const fileName = `${crypto.randomUUID()}.gif`;
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, file, { contentType: 'image/gif' });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
        return publicUrl;
      }

      // Optimize image: crop to 16:9, resize, compress
      const { blob, format } = await optimizeImage(file);
      
      const fileName = `${crypto.randomUUID()}.${format}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, blob, {
          contentType: format === 'webp' ? 'image/webp' : 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      toast({
        title: 'Error al subir la imagen',
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
