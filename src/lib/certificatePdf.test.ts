import { describe, expect, it } from 'vitest';
import {
  CERTIFICATE_LAYOUT_DEFAULTS,
  formatCertificateDate,
  getCertificatePreviewGeometry,
  sanitizeCertificateFilename,
} from './certificatePdf';

describe('certificatePdf', () => {
  it('preserva a proporção intrínseca de cada fundo na prévia', () => {
    const standard = getCertificatePreviewGeometry(600, 3347, 2447, CERTIFICATE_LAYOUT_DEFAULTS);
    const barEventos = getCertificatePreviewGeometry(600, 3369, 2471, CERTIFICATE_LAYOUT_DEFAULTS);

    expect(standard.height).toBeCloseTo(438.6615, 3);
    expect(barEventos.height).toBeCloseTo(440.0119, 3);
    expect(standard.aspectRatio).not.toBe(barEventos.aspectRatio);
  });

  it('mantém as coordenadas globais como percentuais da referência histórica', () => {
    const geometry = getCertificatePreviewGeometry(600, 3347, 2447, CERTIFICATE_LAYOUT_DEFAULTS);
    expect(geometry.nameLeftPercent).toBeCloseTo(50.0149, 3);
    expect(geometry.nameTopPercent).toBeCloseTo(54.5157, 3);
  });

  it('formata a data em português', () => {
    expect(formatCertificateDate('2026-04-16T12:00:00.000Z')).toBe('16 de abril de 2026');
  });

  it('remove caracteres inválidos do nome do arquivo', () => {
    expect(sanitizeCertificateFilename('Curso: Bar / Eventos?')).toBe('Curso- Bar - Eventos-');
  });
});