import { useEffect, useState } from 'react';

/**
 * Promoção de lançamento do Clube.
 * - Ativa automaticamente quando o usuário chega via anúncio (qualquer parâmetro UTM na URL).
 * - Persiste em localStorage por 15 minutos a partir da primeira ativação.
 * - Após expirar: a cada 3 visitas adicionais à página da oferta cheia (R$197),
 *   reativa automaticamente a promo de R$69 por mais 15 minutos.
 * - Sem UTM e sem gatilho de reativação = preço cheio (R$ 197).
 */

export const LAUNCH_PROMO_KEY = 'clube:launch-promo-start';
export const LAUNCH_PROMO_VISITS_KEY = 'clube:launch-promo-fullprice-visits';
export const LAUNCH_PROMO_DURATION_MS = 15 * 60 * 1000; // 15 minutos
export const LAUNCH_PROMO_VISITS_THRESHOLD = 3;
export const PRICE_PROMO = 69;
export const PRICE_FULL = 197;

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

function detectUtm(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return UTM_PARAMS.some((k) => !!params.get(k));
}

function readStart(): number {
  try {
    const v = localStorage.getItem(LAUNCH_PROMO_KEY);
    const n = v ? Number(v) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeStart(ts: number) {
  try {
    localStorage.setItem(LAUNCH_PROMO_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

function readVisits(): number {
  try {
    const v = localStorage.getItem(LAUNCH_PROMO_VISITS_KEY);
    const n = v ? Number(v) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeVisits(n: number) {
  try {
    localStorage.setItem(LAUNCH_PROMO_VISITS_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export interface LaunchPromoState {
  isActive: boolean;
  remainingMs: number;
  mm: string;
  ss: string;
  price: number;
  promoPrice: number;
  fullPrice: number;
}

export function useLaunchPromo(opts?: { promoPrice?: number; fullPrice?: number }): LaunchPromoState {
  const promoPrice = opts?.promoPrice ?? PRICE_PROMO;
  const fullPrice = opts?.fullPrice ?? PRICE_FULL;
  const [startedAt, setStartedAt] = useState<number>(() => readStart());
  const [now, setNow] = useState<number>(() => Date.now());

  // Ativação inicial (UTM) ou reativação por contagem de visitas
  useEffect(() => {
    const existing = readStart();
    const existingValid = existing > 0 && Date.now() - existing < LAUNCH_PROMO_DURATION_MS;

    if (existingValid) {
      setStartedAt(existing);
      return;
    }

    // 1) UTM ativa imediatamente
    if (detectUtm()) {
      const ts = Date.now();
      writeStart(ts);
      writeVisits(0); // zera contador ao iniciar promo
      setStartedAt(ts);
      return;
    }

    // 2) Sem promo ativa → conta visita à oferta cheia.
    //    A cada 3 visitas, reativa a promo por mais 15min e zera o contador.
    const nextVisits = readVisits() + 1;
    if (nextVisits >= LAUNCH_PROMO_VISITS_THRESHOLD) {
      const ts = Date.now();
      writeStart(ts);
      writeVisits(0);
      setStartedAt(ts);
    } else {
      writeVisits(nextVisits);
      setStartedAt(existing); // mantém expirado
    }
  }, []);

  // Tick a cada 1s enquanto promo ativa
  useEffect(() => {
    if (!startedAt) return;
    const elapsed = Date.now() - startedAt;
    if (elapsed >= LAUNCH_PROMO_DURATION_MS) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const remainingMs = startedAt
    ? Math.max(0, LAUNCH_PROMO_DURATION_MS - (now - startedAt))
    : 0;
  const isActive = remainingMs > 0;
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

  return {
    isActive,
    remainingMs,
    mm,
    ss,
    price: isActive ? PRICE_PROMO : PRICE_FULL,
    promoPrice: PRICE_PROMO,
    fullPrice: PRICE_FULL,
  };
}
