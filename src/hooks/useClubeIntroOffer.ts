import { useEffect, useState } from 'react';

/**
 * Oferta INTRO do Clube dos Drinkeros (variante B).
 * - Mostra preço promocional (R$ 97) com countdown de 30 minutos.
 * - A janela reseta TODA SEMANA: o "start" persiste em localStorage por 7 dias.
 *   Após 7 dias, na próxima visita a janela reinicia (+30min novamente).
 * - Quando a janela expira (30min passados) e ainda estamos na semana atual,
 *   a oferta fica indisponível até a próxima semana → preço cheio (R$ 197).
 */
export const CLUBE_INTRO_KEY = 'clube:intro-week-start';
export const CLUBE_INTRO_WINDOW_MS = 30 * 60 * 1000;       // 30 min
export const CLUBE_INTRO_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export const CLUBE_PRICE_INTRO = 97;
export const CLUBE_PRICE_FULL = 197;

function readStart(): number {
  try {
    const v = localStorage.getItem(CLUBE_INTRO_KEY);
    const n = v ? Number(v) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeStart(ts: number) {
  try {
    localStorage.setItem(CLUBE_INTRO_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

export interface ClubeIntroOfferState {
  isActive: boolean;
  remainingMs: number;
  mm: string;
  ss: string;
  price: number;
  promoPrice: number;
  fullPrice: number;
}

export function useClubeIntroOffer(): ClubeIntroOfferState {
  const [startedAt, setStartedAt] = useState<number>(() => readStart());
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    // A oferta intro (R$97) deve estar SEMPRE ativa quando o usuário visita a /clube-b.
    // Se a janela de 30min já expirou (ou nunca existiu), reiniciamos para manter
    // o preço promocional + countdown de urgência sempre visível.
    const existing = readStart();
    const nowTs = Date.now();
    const windowExpired = !existing || nowTs - existing >= CLUBE_INTRO_WINDOW_MS;
    if (windowExpired) {
      writeStart(nowTs);
      setStartedAt(nowTs);
    } else {
      setStartedAt(existing);
    }
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    const elapsed = Date.now() - startedAt;
    if (elapsed >= CLUBE_INTRO_WINDOW_MS) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const remainingMs = startedAt
    ? Math.max(0, CLUBE_INTRO_WINDOW_MS - (now - startedAt))
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
    price: isActive ? CLUBE_PRICE_INTRO : CLUBE_PRICE_FULL,
    promoPrice: CLUBE_PRICE_INTRO,
    fullPrice: CLUBE_PRICE_FULL,
  };
}
