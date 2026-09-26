import { describe, expect, it } from 'vitest';
import {
  CERTIFICATE_LAYOUT_DEFAULTS,
  formatCertificateDate,
  getCertificateNameLayout,
  getCertificatePreviewGeometry,
  sanitizeCertificateFilename,
} from './certificatePdf';

describe('certificatePdf', () => {
  it('preserva a proporção intrínseca de cada fundo na prévia', () => {
    const standard = getCertificatePreviewGeometry(600, 3347, 2447, CERTIFICATE_LAYOUT_DEFAULTS);
    const barEventos = getCertificatePreviewGeometry(600, 3369, 2471, CERTIFICATE_LAYOUT_DEFAULTS);

    expect(standard.height).toBeCloseTo(438.6615, 3);
    expect(barEventos.height).toBeCloseTo(440.0712, 3);
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

  it('preserva integralmente um nome longo ao ajustar fonte e linhas', () => {
    const name = 'Maria Fernanda de Oliveira Nascimento Albuquerque dos Santos Pereira Cavalcante';
    const fitted = getCertificateNameLayout(name, 26, 125);

    expect(fitted.lines.length).toBeGreaterThan(1);
    expect(fitted.lines.length).toBeLessThanOrEqual(2);
    expect(fitted.lines.join(' ').replace(/\s+/g, ' ')).toBe(name);
    expect(fitted.fontSizePt).toBeLessThanOrEqual(12);
  });

  it('falha explicitamente quando o nome completo não cabe na área segura', () => {
    const impossibleName = Array.from({ length: 80 }, () => 'Extraordinariamente').join(' ');

    expect(() => getCertificateNameLayout(impossibleName, 26, 80)).toThrow(
      'O nome completo é longo demais para a área segura do certificado.',
    );
  });

  it('recalcula o layout do nome quando a fonte preferida muda', () => {
    const name = 'Maria Fernanda de Oliveira Nascimento Albuquerque dos Santos';
    const at26 = getCertificateNameLayout(name, 26);
    const at18 = getCertificateNameLayout(name, 18);

    expect(at26.fontSizePt).toBeGreaterThan(at18.fontSizePt);
    expect(at26.lines.join(' ')).toBe(name);
    expect(at18.lines.join(' ')).toBe(name);
  });
});