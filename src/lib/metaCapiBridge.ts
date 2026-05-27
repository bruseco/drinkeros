// Bridge client-side: dispara um evento Meta padrão pelo Pixel E pelo CAPI
// server-side com o MESMO event_id (deduplicação no Gerenciador de Eventos).
//
// FASE 1 — atualmente exposto apenas o helper `trackLead`. Os helpers para
// CompleteRegistration e InitiateCheckout virão nas próximas fases.
//
// Regra de uso para Lead: chame APENAS após submissão bem-sucedida de um
// formulário real de captura (newsletter, contato, lead magnet, etc.).
// Não use em cliques de intenção, hovers ou pageviews.

import { supabase } from '@/integrations/supabase/client';
import { trackFbEvent } from '@/lib/metaPixel';

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : undefined;
}

function buildEventId(prefix: string, parts: Array<string | undefined>): string {
  const tail = parts.filter(Boolean).join(':') || 'anon';
  return `${prefix}:${tail}:${Date.now()}`;
}

export interface TrackLeadOptions {
  /** Identificador da fonte do lead. Ex: 'newsletter_form', 'contato_form'. */
  source: string;
  /** Rótulo do conteúdo. Ex: 'Newsletter Drinkeros'. */
  content_name?: string;
  /** Email coletado no form (será normalizado e hasheado no servidor). */
  email?: string;
  /** Telefone coletado no form (apenas dígitos, com DDI quando possível). */
  phone?: string;
  /** ID interno do lead (user_id, lead_id, etc.) — entra no event_id e em external_id. */
  identifier?: string;
  /** Campos extras enviados no custom_data. */
  extra?: Record<string, unknown>;
}

/**
 * Dispara o evento `Lead` no Pixel client-side e no CAPI server-side,
 * compartilhando o mesmo event_id para deduplicação.
 *
 * Retorna o event_id usado (útil para logs / debugging).
 */
export async function trackLead(opts: TrackLeadOptions): Promise<string> {
  const idPart = opts.identifier || opts.email || 'anon';
  const eventId = buildEventId('lead', [opts.source, idPart]);

  const customData: Record<string, unknown> = {
    source: opts.source,
    ...(opts.content_name ? { content_name: opts.content_name } : {}),
    ...(opts.extra || {}),
  };

  // 1. Pixel client-side — mesmo eventId p/ dedupe
  trackFbEvent('Lead', customData, { eventId, dedupeKey: eventId });

  // 2. CAPI server-side — fire-and-forget; falha não bloqueia UI
  supabase.functions
    .invoke('meta-capi-track', {
      body: {
        event_name: 'Lead',
        event_id: eventId,
        event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
        custom_data: customData,
        user_data: {
          email: opts.email,
          phone: opts.phone,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
        },
      },
    })
    .then((r) => {
      if (r.error) console.warn('[meta-capi-bridge] Lead CAPI erro:', r.error);
      else console.log('[meta-capi-bridge] Lead CAPI ok', eventId);
    })
    .catch((e) => console.warn('[meta-capi-bridge] Lead exception:', e));

  return eventId;
}

// ---------------------------------------------------------------------------
// CompleteRegistration — dispara após signup bem-sucedido (email ou OAuth).
// ---------------------------------------------------------------------------
export interface TrackCompleteRegistrationOptions {
  userId?: string;
  email?: string;
  phone?: string;
  fullName?: string;
  method: string; // 'email' | 'google' | 'apple' | 'oauth' | ...
  content_name?: string;
}

export async function trackCompleteRegistration(
  opts: TrackCompleteRegistrationOptions,
): Promise<string> {
  const eventId = `signup:${opts.userId || opts.email || 'anon'}`;

  const customData: Record<string, unknown> = {
    content_name: opts.content_name || 'Drinkeros Account Registration',
    status: 'success',
    method: opts.method,
  };

  trackFbEvent('CompleteRegistration', customData, {
    eventId,
    dedupeKey: `user:${opts.userId || opts.email}`,
  });

  supabase.functions
    .invoke('meta-capi-track', {
      body: {
        event_name: 'CompleteRegistration',
        event_id: eventId,
        event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
        custom_data: customData,
        user_data: {
          email: opts.email,
          phone: opts.phone,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
        },
      },
    })
    .then((r) => {
      if (r.error) console.warn('[meta-capi-bridge] CompleteRegistration CAPI erro:', r.error);
      else console.log('[meta-capi-bridge] CompleteRegistration CAPI ok', eventId, r.data);
    })
    .catch((e) => console.warn('[meta-capi-bridge] CompleteRegistration exception:', e));

  return eventId;
}

// ---------------------------------------------------------------------------
// PageView — espelha no CAPI para aparecer em "Eventos de teste" (test_event_code).
// O Pixel client-side já dispara PageView; aqui usamos o MESMO event_id p/ dedupe.
// Fire-and-forget; usado pelo FacebookPixel a cada troca de rota.
// ---------------------------------------------------------------------------
export function trackPageViewCapi(pathname: string, eventId: string) {
  supabase.functions
    .invoke('meta-capi-track', {
      body: {
        event_name: 'PageView',
        event_id: eventId,
        event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
        custom_data: { path: pathname },
        user_data: {
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
        },
      },
    })
    .then((r) => {
      if (r.error) console.warn('[meta-capi-bridge] PageView CAPI erro:', r.error);
      else console.log('[meta-capi-bridge] PageView CAPI ok', eventId);
    })
    .catch((e) => console.warn('[meta-capi-bridge] PageView exception:', e));
}
