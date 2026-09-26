import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Minus, Plus } from 'lucide-react';
import { useCertificateLayout, useUpdateCertificateLayout, CertificateLayout } from '@/hooks/useCertificateLayout';
import { useToast } from '@/hooks/use-toast';
import {
  CERTIFICATE_LAYOUT_DEFAULTS,
  CERTIFICATE_LONG_NAME,
  downloadCertificatePdf,
  fitPreviewNameFontSize,
  getCertificatePreviewGeometry,
} from '@/lib/certificatePdf';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bgUrl: string;
  textColor: string;
}

const CertificateLayoutDialog: React.FC<Props> = ({ open, onOpenChange, bgUrl, textColor }) => {
  const { data: layout, isLoading } = useCertificateLayout();
  const updateLayout = useUpdateCertificateLayout();
  const { toast } = useToast();

  const [nameX, setNameX] = useState(CERTIFICATE_LAYOUT_DEFAULTS.name_x);
  const [nameY, setNameY] = useState(CERTIFICATE_LAYOUT_DEFAULTS.name_y);
  const [dateX, setDateX] = useState(CERTIFICATE_LAYOUT_DEFAULTS.date_x);
  const [dateY, setDateY] = useState(CERTIFICATE_LAYOUT_DEFAULTS.date_y);
  const [nameFontSize, setNameFontSize] = useState(CERTIFICATE_LAYOUT_DEFAULTS.name_font_size);
  const [dateFontSize, setDateFontSize] = useState(CERTIFICATE_LAYOUT_DEFAULTS.date_font_size);
  const [imageSize, setImageSize] = useState({ width: 3347, height: 2447 });
  const [previewWidth, setPreviewWidth] = useState(600);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (layout) {
      setNameX(layout.name_x);
      setNameY(layout.name_y);
      setDateX(layout.date_x);
      setDateY(layout.date_y);
      setNameFontSize(layout.name_font_size);
      setDateFontSize(layout.date_font_size);
    }
  }, [layout]);

  useEffect(() => {
    if (!bgUrl) return;
    const image = new Image();
    image.onload = () => setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = bgUrl;
  }, [bgUrl]);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const observer = new ResizeObserver(([entry]) => setPreviewWidth(entry.contentRect.width));
    observer.observe(preview);
    return () => observer.disconnect();
  }, [isLoading]);

  const handleSave = () => {
    if (!layout?.id) return;
    updateLayout.mutate({
      id: layout.id,
      name_x: nameX,
      name_y: nameY,
      date_x: dateX,
      date_y: dateY,
      name_font_size: nameFontSize,
      date_font_size: dateFontSize,
    });
  };

  const currentLayout = {
    name_x: nameX,
    name_y: nameY,
    date_x: dateX,
    date_y: dateY,
    name_font_size: nameFontSize,
    date_font_size: dateFontSize,
  };

  const handleFictionalTest = async () => {
    if (!bgUrl) return;
    setIsGeneratingTest(true);
    try {
      await downloadCertificatePdf({
        backgroundUrl: bgUrl,
        studentName: CERTIFICATE_LONG_NAME,
        completedAt: '2026-04-16T12:00:00.000Z',
        referenceName: 'Prévia fictícia',
        textColor,
        layout: currentLayout,
      });
      toast({ title: 'Teste fictício gerado', description: 'Nenhum certificado ou progresso foi registrado.' });
    } catch (error) {
      toast({
        title: 'Não foi possível gerar o teste',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingTest(false);
    }
  };

  const PixelControl = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
  }) => (
    <div className="flex items-center gap-2">
      <Label className="w-16 text-xs shrink-0">{label}</Label>
      <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => onChange(value - 1)}>
        <Minus className="h-3 w-3" />
      </Button>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 w-20 text-xs font-mono text-center"
      />
      <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => onChange(value + 1)}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );

  const geometry = getCertificatePreviewGeometry(previewWidth, imageSize.width, imageSize.height, currentLayout);
  const previewNameFontSize = fitPreviewNameFontSize(
    CERTIFICATE_LONG_NAME,
    geometry.nameFontSizePx,
    geometry.maxNameWidthPx,
    (value, size) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return value.length * size * 0.5;
      context.font = `${size}px Helvetica, Arial, sans-serif`;
      return context.measureText(value).width;
    },
  );
  const nameRenderFontSize = Math.max(previewNameFontSize, 16);
  const nameRenderScale = previewNameFontSize / nameRenderFontSize;
  const dateRenderFontSize = Math.max(geometry.dateFontSizePx, 16);
  const dateRenderScale = geometry.dateFontSizePx / dateRenderFontSize;

  const nameStyle: React.CSSProperties = {
    position: 'absolute',
    display: 'block',
    left: `${geometry.nameLeftPercent}%`,
    top: `${geometry.nameTopPercent}%`,
    transform: `translate(-50%, -50%) scale(${nameRenderScale})`,
    transformOrigin: 'center',
    color: textColor,
    fontSize: `${nameRenderFontSize}px`,
    fontFamily: 'Helvetica, Arial, sans-serif',
    lineHeight: 1.15,
    maxWidth: `${geometry.maxNameWidthPx / nameRenderScale}px`,
    width: `${geometry.maxNameWidthPx / nameRenderScale}px`,
    whiteSpace: 'nowrap',
    WebkitTextSizeAdjust: 'none',
    textSizeAdjust: 'none',
    textAlign: 'center',
    pointerEvents: 'none',
  };

  const dateStyle: React.CSSProperties = {
    position: 'absolute',
    display: 'block',
    left: `${geometry.dateLeftPercent}%`,
    top: `${geometry.dateTopPercent}%`,
    transform: `translate(-50%, -50%) scale(${dateRenderScale})`,
    transformOrigin: 'center',
    color: textColor,
    fontSize: `${dateRenderFontSize}px`,
    fontFamily: 'Helvetica, Arial, sans-serif',
    whiteSpace: 'nowrap',
    WebkitTextSizeAdjust: 'none',
    textSizeAdjust: 'none',
    pointerEvents: 'none',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustar Posição Global do Certificado</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview */}
            <div
              ref={previewRef}
              className="relative mx-auto w-full overflow-hidden rounded-lg border"
              style={{ aspectRatio: geometry.aspectRatio }}
            >
              {bgUrl ? (
                <img src={bgUrl} alt="Certificado" className="h-full w-full object-contain" />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                  Sem imagem de fundo
                </div>
              )}
              <span style={nameStyle}>{CERTIFICATE_LONG_NAME}</span>
              <span style={dateStyle}>16 de abril de 2026</span>
            </div>

            {/* Controls */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 p-3 border rounded-lg">
                <p className="text-sm font-medium">Nome do Aluno</p>
                <PixelControl label="X (px)" value={nameX} onChange={setNameX} />
                <PixelControl label="Y (px)" value={nameY} onChange={setNameY} />
                <PixelControl label="Fonte" value={nameFontSize} onChange={setNameFontSize} />
              </div>
              <div className="space-y-2 p-3 border rounded-lg">
                <p className="text-sm font-medium">Data</p>
                <PixelControl label="X (px)" value={dateX} onChange={setDateX} />
                <PixelControl label="Y (px)" value={dateY} onChange={setDateY} />
                <PixelControl label="Fonte" value={dateFontSize} onChange={setDateFontSize} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Fundo atual: {imageSize.width}×{imageSize.height}px. A prévia e o PDF preservam a imagem inteira e usam as mesmas posições proporcionais.
            </p>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleFictionalTest} disabled={!bgUrl || isGeneratingTest}>
                {isGeneratingTest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Baixar teste fictício
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={updateLayout.isPending}>
                {updateLayout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Posições
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CertificateLayoutDialog;
