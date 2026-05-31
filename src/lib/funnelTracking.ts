import { supabase } from '@/integrations/supabase/client';

/**
 * Funil de páginas de venda.
 * Cada (page_key, event, session_id) só conta uma vez no banco.
 * Adicionalmente fazemos dedup local via sessionStorage para não disparar requests
 * repetidos durante a mesma sessão.
 */

export type FunnelEvent =
  | 'pageview'
  | 'offer_1_revealed'
  | 'checkout_1_started'
  | 'offer_2_revealed'
  | 'checkout_2_started'
  | 'subscription_confirmed';

const SESSION_KEY = 'funnel:sid';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let sid = window.sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid =
        (crypto?.randomUUID?.() as string | undefined) ??
        `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return `sid-${Date.now()}`;
  }
}

function markedLocally(pageKey: string, event: FunnelEvent): boolean {
  if (typeof window === 'undefined') return true;
  const key = `funnel:${pageKey}:${event}`;
  try {
    if (window.sessionStorage.getItem(key)) return true;
    window.sessionStorage.setItem(key, '1');
    return false;
  } catch {
    return false;
  }
}

export interface TrackFunnelOpts {
  amountCents?: number;
  userId?: string | null;
  metadata?: Record<string, unknown>;
  /** Permite forçar mesmo se já marcado localmente (útil em retries). */
  force?: boolean;
}

export function trackFunnel(
  pageKey: string,
  event: FunnelEvent,
  opts: TrackFunnelOpts = {},
): void {
  if (!pageKey) return;
  if (!opts.force && markedLocally(pageKey, event)) return;

  const sid = getSessionId();
  Promise.resolve(
    supabase.rpc('track_funnel_event' as any, {
      _page_key: pageKey,
      _event: event,
      _session_id: sid,
      _user_id: opts.userId ?? null,
      _amount_cents: opts.amountCents ?? null,
      _metadata: (opts.metadata ?? {}) as any,
    }),
  ).catch(() => {
    /* fire-and-forget */
  });
}
