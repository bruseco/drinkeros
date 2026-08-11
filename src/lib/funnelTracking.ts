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
  void trackFunnelAsync(pageKey, event, opts);
}

/**
 * Versão aguardável — use antes de navegar para o checkout, senão a navegação
 * cancela a request e o evento se perde.
 */
export async function trackFunnelAsync(
  pageKey: string,
  event: FunnelEvent,
  opts: TrackFunnelOpts = {},
): Promise<void> {
  if (!pageKey) return;
  if (!opts.force && markedLocally(pageKey, event)) return;

  const sid = getSessionId();
  const body = {
    _page_key: pageKey,
    _event: event,
    _session_id: sid,
    _user_id: opts.userId ?? null,
    _amount_cents: opts.amountCents ?? null,
    _metadata: opts.metadata ?? {},
  };

  // `keepalive` garante que a request sobreviva à navegação da página.
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/track_funnel_event`;
    const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token ?? anon;
    await fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    return;
  } catch {
    /* fallback abaixo */
  }

  try {
    await supabase.rpc('track_funnel_event' as any, body as any);
  } catch {
    /* fire-and-forget */
  }
}

