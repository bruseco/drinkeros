import jsPDF from 'jspdf';

export interface CertificateLayoutValues {
  name_x: number;
  name_y: number;
  date_x: number;
  date_y: number;
  name_font_size: number;
  date_font_size: number;
}

export interface CertificateImageData {
  dataUrl: string;
  width: number;
  height: number;
  format: 'PNG' | 'JPEG';
  mimeType: string;
}

export interface CertificatePdfInput {
  backgroundUrl: string;
  studentName: string;
  completedAt: string;
  referenceName: string;
  textColor: string;
  layout: CertificateLayoutValues;
}

export interface CertificateRenderMetrics {
  imageWidthPx: number;
  imageHeightPx: number;
  imageFormat: 'PNG' | 'JPEG';
  pdfWidthMm: number;
  pdfHeightMm: number;
  nameFontSizePt: number;
  nameLines: number;
}

export interface CertificateNameLayout {
  fontSizePt: number;
  lines: string[];
}

export const CERTIFICATE_LAYOUT_REFERENCE = { width: 3347, height: 2447 } as const;
export const CERTIFICATE_PDF_WIDTH_MM = 297;
export const CERTIFICATE_LONG_NAME = 'Maria Fernanda de Oliveira Nascimento Albuquerque dos Santos Pereira Cavalcante de Almeida Rodrigues Montenegro';

export const CERTIFICATE_LAYOUT_DEFAULTS: CertificateLayoutValues = {
  name_x: 1674,
  name_y: 1234,
  date_x: 788,
  date_y: 1901,
  name_font_size: 26,
  date_font_size: 14,
};

const MAX_NAME_WIDTH_RATIO = 0.68;
const MIN_NAME_FONT_SIZE_PT = 12;
const ABSOLUTE_MIN_NAME_FONT_SIZE_PT = 9;
const MAX_NAME_LINES = 2;

export function formatCertificateDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

export function sanitizeCertificateFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

export function getCertificatePreviewGeometry(
  containerWidth: number,
  imageWidth: number,
  imageHeight: number,
  layout: CertificateLayoutValues,
) {
  const reference = CERTIFICATE_LAYOUT_REFERENCE;
  const pdfWidthPt = (CERTIFICATE_PDF_WIDTH_MM * 72) / 25.4;
  return {
    aspectRatio: imageWidth / imageHeight,
    height: containerWidth * (imageHeight / imageWidth),
    nameLeftPercent: (layout.name_x / reference.width) * 100,
    nameTopPercent: (layout.name_y / reference.height) * 100,
    dateLeftPercent: (layout.date_x / reference.width) * 100,
    dateTopPercent: (layout.date_y / reference.height) * 100,
    nameFontSizePx: layout.name_font_size * (containerWidth / pdfWidthPt),
    dateFontSizePx: layout.date_font_size * (containerWidth / pdfWidthPt),
    maxNameWidthPx: containerWidth * MAX_NAME_WIDTH_RATIO,
  };
}

function parseTextColor(textColor: string): [number, number, number] {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(textColor);
  if (!match) return [255, 255, 255];
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

function readImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Não foi possível ler as dimensões do fundo do certificado.'));
    image.src = dataUrl;
  });
}

export async function loadCertificateImage(url: string): Promise<CertificateImageData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Não foi possível carregar o fundo do certificado.');

  const blob = await response.blob();
  const mimeType = blob.type.toLowerCase();
  const format = mimeType.includes('png') ? 'PNG' : mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'JPEG' : null;
  if (!format) throw new Error('O fundo do certificado precisa ser PNG ou JPEG.');

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Não foi possível preparar o fundo do certificado.'));
    reader.onerror = () => reject(new Error('Não foi possível preparar o fundo do certificado.'));
    reader.readAsDataURL(blob);
  });
  const dimensions = await readImageDimensions(dataUrl);
  return { dataUrl, ...dimensions, format, mimeType };
}

function assertNameWasPreserved(name: string, lines: string[]): void {
  const normalizedName = name.replace(/\s+/g, ' ').trim();
  const normalizedLines = lines.join(' ').replace(/\s+/g, ' ').trim();
  if (normalizedLines !== normalizedName) {
    throw new Error('Não foi possível preservar o nome completo no certificado.');
  }
}

function fitNameWithDocument(
  doc: jsPDF,
  rawName: string,
  preferredSize: number,
  maxWidthMm: number,
): CertificateNameLayout {
  const name = rawName.replace(/\s+/g, ' ').trim() || 'Aluno';
  if (!Number.isFinite(preferredSize) || preferredSize <= 0) {
    throw new Error('O tamanho da fonte do nome precisa ser maior que zero.');
  }

  doc.setFont('helvetica', 'normal');
  const singleLineMinimum = Math.min(preferredSize, MIN_NAME_FONT_SIZE_PT);
  for (let fontSize = preferredSize; fontSize >= singleLineMinimum; fontSize -= 0.5) {
    doc.setFontSize(fontSize);
    if (doc.getTextWidth(name) <= maxWidthMm) return { fontSizePt: fontSize, lines: [name] };
  }

  const multilineStart = singleLineMinimum;
  const multilineMinimum = Math.min(multilineStart, ABSOLUTE_MIN_NAME_FONT_SIZE_PT);
  for (let fontSize = multilineStart; fontSize >= multilineMinimum; fontSize -= 0.5) {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(name, maxWidthMm) as string[];
    const allLinesFit = lines.every((line) => doc.getTextWidth(line) <= maxWidthMm);
    if (lines.length <= MAX_NAME_LINES && allLinesFit) {
      assertNameWasPreserved(name, lines);
      return { fontSizePt: fontSize, lines };
    }
  }

  throw new Error('O nome completo é longo demais para a área segura do certificado. Revise o nome antes de gerar.');
}

export function getCertificateNameLayout(
  name: string,
  preferredSizePt: number,
  maxWidthMm = CERTIFICATE_PDF_WIDTH_MM * MAX_NAME_WIDTH_RATIO,
): CertificateNameLayout {
  const measurementDoc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  return fitNameWithDocument(measurementDoc, name, preferredSizePt, maxWidthMm);
}

export async function buildCertificatePdf(input: CertificatePdfInput): Promise<{
  doc: jsPDF;
  metrics: CertificateRenderMetrics;
}> {
  const image = await loadCertificateImage(input.backgroundUrl);
  const pdfWidth = CERTIFICATE_PDF_WIDTH_MM;
  const pdfHeight = pdfWidth * (image.height / image.width);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pdfWidth, pdfHeight] });

  doc.addImage(image.dataUrl, image.format, 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

  const [red, green, blue] = parseTextColor(input.textColor);
  doc.setTextColor(red, green, blue);

  const reference = CERTIFICATE_LAYOUT_REFERENCE;
  const nameX = (input.layout.name_x / reference.width) * pdfWidth;
  const nameY = (input.layout.name_y / reference.height) * pdfHeight;
  const dateX = (input.layout.date_x / reference.width) * pdfWidth;
  const dateY = (input.layout.date_y / reference.height) * pdfHeight;
  const fittedName = fitNameWithDocument(doc, input.studentName, input.layout.name_font_size, pdfWidth * MAX_NAME_WIDTH_RATIO);
  const nameLineHeightMm = (fittedName.fontSizePt * 1.15 * 25.4) / 72;
  const firstNameY = nameY - ((fittedName.lines.length - 1) * nameLineHeightMm) / 2;

  doc.setFontSize(fittedName.fontSizePt);
  doc.text(fittedName.lines, nameX, firstNameY, {
    align: 'center',
    baseline: 'middle',
    lineHeightFactor: 1.15,
  });

  doc.setFontSize(input.layout.date_font_size);
  doc.text(formatCertificateDate(input.completedAt), dateX, dateY, { align: 'center', baseline: 'middle' });

  return {
    doc,
    metrics: {
      imageWidthPx: image.width,
      imageHeightPx: image.height,
      imageFormat: image.format,
      pdfWidthMm: pdfWidth,
      pdfHeightMm: pdfHeight,
      nameFontSizePt: fittedName.fontSizePt,
      nameLines: fittedName.lines.length,
    },
  };
}

export async function downloadCertificatePdf(input: CertificatePdfInput): Promise<CertificateRenderMetrics> {
  const { doc, metrics } = await buildCertificatePdf(input);
  doc.save(`Certificado - ${sanitizeCertificateFilename(input.referenceName)}.pdf`);
  return metrics;
}