import { useEffect, useState } from 'react';

/**
 * Promoção de lançamento do Clube.
 * - Ativa automaticamente quando o usuário chega via anúncio (qualquer parâmetro UTM na URL).
 * - Persiste em localStorage por 15 minutos a partir da primeira ativação.
 * - Sem UTM e sem registro prévio = promoção inativa, preço cheio (R$ 197).
 * - Após expirar, preço volta para R$ 197 e timer/banner somem.
 */

export const LAUNCH_PROMO_KEY = 'clube:launch-promo-start';
export const LAUNCH_PROMO_DURATION_MS = 15 * 60 * 1000; // 15 minutos
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

export interface LaunchPromoState {
  /** Promoção ativa e ainda não expirou */
  isActive: boolean;
  /** Tempo restante em ms (0 quando inativo/expirado) */
  remainingMs: number;
  mm: string;
  ss: string;
  /** Preço a exibir no momento (R$ 69 ativo, R$ 197 inativo/expirado) */
  price: number;
  /** Preço promocional fixo */
  promoPrice: number;
  /** Preço cheio fixo */
  fullPrice: number;
}

export function useLaunchPromo(): LaunchPromoState {
  const [startedAt, setStartedAt] = useState<number>(() => readStart());
  const [now, setNow] = useState<number>(() => Date.now());

  // Ativa via UTM no mount (1x). Se já existe start válido, reaproveita.
  useEffect(() => {
    const existing = readStart();
    const existingValid = existing > 0 && Date.now() - existing < LAUNCH_PROMO_DURATION_MS;
    if (existingValid) {
      setStartedAt(existing);
      return;
    }
    if (detectUtm()) {
      const ts = Date.now();
      writeStart(ts);
      setStartedAt(ts);
    } else if (existing > 0 && !existingValid) {
      // expirado: mantém registro mas não reativa sem UTM
      setStartedAt(existing);
    }
  }, []);

  // Tick a cada 1s enquanto promo ativa
  useEffect(() => {
    if (!startedAt) return;
    const elapsed = Date.now() - startedAt;
    if (elapsed >= LAUNCH_PROMO_DURATION_MS) return; // já expirou, nada a tickar
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
