import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Minus, Plus } from 'lucide-react';
import { useCertificateLayout, useUpdateCertificateLayout, CertificateLayout } from '@/hooks/useCertificateLayout';

const IMG_W = 3347;
const IMG_H = 2447;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bgUrl: string;
  textColor: string;
}

const CertificateLayoutDialog: React.FC<Props> = ({ open, onOpenChange, bgUrl, textColor }) => {
  const { data: layout, isLoading } = useCertificateLayout();
  const updateLayout = useUpdateCertificateLayout();

  const [nameX, setNameX] = useState(1674);
  const [nameY, setNameY] = useState(1334);
  const [dateX, setDateX] = useState(897);
  const [dateY, setDateY] = useState(1886);
  const [nameFontSize, setNameFontSize] = useState(28);
  const [dateFontSize, setDateFontSize] = useState(14);

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

  // Preview: scale the image to fit the dialog
  const previewWidth = 600;
  const scale = previewWidth / IMG_W;
  const previewHeight = IMG_H * scale;

  const nameStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${nameX * scale}px`,
    top: `${nameY * scale}px`,
    transform: 'translateX(-50%)',
    color: textColor,
    fontSize: `${nameFontSize * scale}px`,
    fontFamily: 'Helvetica, Arial, sans-serif',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  };

  const dateStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${dateX * scale}px`,
    top: `${dateY * scale}px`,
    transform: 'translateX(-50%)',
    color: textColor,
    fontSize: `${dateFontSize * scale}px`,
    fontFamily: 'Helvetica, Arial, sans-serif',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto">
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
              className="relative mx-auto border rounded-lg overflow-hidden"
              style={{ width: previewWidth, height: previewHeight }}
            >
              {bgUrl ? (
                <img src={bgUrl} alt="Certificado" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                  Sem imagem de fundo
                </div>
              )}
              <span style={nameStyle}>Nome do Aluno</span>
              <span style={dateStyle}>16 de abril de 2026</span>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-2 gap-4">
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
              Posições em pixels reais da imagem (3347×2447). O preview mostra a posição proporcional.
            </p>

            <div className="flex justify-end gap-2">
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
