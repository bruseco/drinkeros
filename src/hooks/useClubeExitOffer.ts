import { useEffect, useState, useCallback } from 'react';

/**
 * Oferta EXTRA do Clube (R$ 69) — disparada quando o usuário tenta sair de /clube-b.
 * Após dispararmos a primeira vez, a oferta fica VÁLIDA por 10 minutos (persistida
 * em localStorage) — mesmo se a pessoa fechar/voltar, ela ainda pode pegar o preço
 * de R$ 69 dentro desse intervalo. Após 10 min, volta o preço padrão.
 */
export const CLUBE_EXIT_KEY = 'clube:exit-offer-started-at';
export const CLUBE_EXIT_WINDOW_MS = 10 * 60 * 1000; // 10 min

export const CLUBE_EXIT_PRICE = 69;
export const CLUBE_EXIT_DISCOUNT = 28; // R$28 a mais que a oferta intro (97 → 69)

function readStart(): number {
  try {
    const v = localStorage.getItem(CLUBE_EXIT_KEY);
    const n = v ? Number(v) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeStart(ts: number) {
  try {
    localStorage.setItem(CLUBE_EXIT_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

export interface ClubeExitOfferState {
  isActive: boolean;
  remainingMs: number;
  mm: string;
  ss: string;
  price: number;
  discount: number;
  start: () => void;
}

export function useClubeExitOffer(): ClubeExitOfferState {
  const [startedAt, setStartedAt] = useState<number>(() => readStart());
  const [now, setNow] = useState<number>(() => Date.now());

  // Reage a mudanças vindas de outras abas/componentes (storage event).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CLUBE_EXIT_KEY) setStartedAt(readStart());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const remainingMs = startedAt
    ? Math.max(0, CLUBE_EXIT_WINDOW_MS - (now - startedAt))
    : 0;
  const isActive = remainingMs > 0;

  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isActive]);

  const start = useCallback(() => {
    const ts = Date.now();
    writeStart(ts);
    setStartedAt(ts);
  }, []);

  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

  return {
    isActive,
    remainingMs,
    mm,
    ss,
    price: CLUBE_EXIT_PRICE,
    discount: CLUBE_EXIT_DISCOUNT,
    start,
  };
}
