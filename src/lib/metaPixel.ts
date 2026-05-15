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

/**
 * Dispara InitiateCheckout com dados dinâmicos vindos do backend (Stripe/MP)
 * imediatamente antes de redirecionar/processar o checkout.
 * Usa dedupeKey para evitar duplo disparo (clique duplo, retry, etc.).
 */
export function trackInitiateCheckout(checkout: {
  amount?: number;
  currency?: string;
  product_name?: string;
  product_type?: string;
  product_id?: string;
  price_id?: string;
  preference_id?: string;
  session_id?: string;
  id?: string | number;
}) {
  const contentId =
    checkout.product_id ||
    checkout.price_id ||
    checkout.preference_id ||
    checkout.session_id ||
    (checkout.id != null ? String(checkout.id) : undefined);

  trackFbEvent(
    'InitiateCheckout',
    {
      value: typeof checkout.amount === 'number' ? checkout.amount : undefined,
      currency: checkout.currency || 'BRL',
      content_name: checkout.product_name,
      content_type: checkout.product_type || 'product',
      content_ids: contentId ? [contentId] : undefined,
      num_items: 1,
    },
    { dedupeKey: `ic:${contentId || checkout.product_name || 'unknown'}` },
  );
}

/**
 * Aguarda um pequeno tick para garantir que o fbq foi enfileirado
 * antes de fazer redirect (window.location.href).
 */
export function waitForPixelFlush(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
