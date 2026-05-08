// Utilitário central para eventos do Meta Pixel.
// Verifica se window.fbq existe antes de disparar.
// Inclui logs temporários no console para validação.

declare global {
  interface Window {
    fbq?: any;
  }
}

type FbEvent =
  | 'CompleteRegistration'
  | 'Lead'
  | 'ViewContent'
  | 'InitiateCheckout'
  | 'Subscribe'
  | 'Purchase';

const firedOnce = new Set<string>();

/**
 * Dispara um evento padrão do Meta Pixel.
 * @param event Nome do evento padrão
 * @param params Parâmetros opcionais (content_name, value, currency, etc.)
 * @param options.dedupeKey Se informado, evita disparar o mesmo evento+chave mais de uma vez na sessão (memória + sessionStorage).
 */
export function trackFbEvent(
  event: FbEvent,
  params?: Record<string, any>,
  options?: { dedupeKey?: string }
) {
  if (typeof window === 'undefined') return;

  const dedupeKey = options?.dedupeKey;
  if (dedupeKey) {
    const fullKey = `fbq:${event}:${dedupeKey}`;
    if (firedOnce.has(fullKey)) {
      console.log('[MetaPixel] skip (dedupe memória)', event, dedupeKey);
      return;
    }
    try {
      if (sessionStorage.getItem(fullKey) === '1') {
        firedOnce.add(fullKey);
        console.log('[MetaPixel] skip (dedupe sessionStorage)', event, dedupeKey);
        return;
      }
      sessionStorage.setItem(fullKey, '1');
    } catch {
      /* ignore */
    }
    firedOnce.add(fullKey);
  }

  if (!window.fbq) {
    console.warn('[MetaPixel] window.fbq indisponível, evento ignorado:', event, params);
    return;
  }

  try {
    if (params && Object.keys(params).length > 0) {
      window.fbq('track', event, params);
    } else {
      window.fbq('track', event);
    }
    console.log('[MetaPixel] track', event, params || '');
  } catch (err) {
    console.warn('[MetaPixel] erro ao disparar', event, err);
  }
}
