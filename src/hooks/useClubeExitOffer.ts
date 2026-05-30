import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Oferta EXTRA do Clube (R$ 69) — vinculada ao usuário.
 * Só pode começar depois que a primeira oferta (R$97) já foi revelada em /clube-b.
 * A validade fica salva em `profiles.clube_exit_eligible_until`, sem depender do browser.
 */
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
  canStart: boolean;
  remainingMs: number;
  mm: string;
  ss: string;
  price: number;
  discount: number;
  start: () => Promise<void>;
}

export function useClubeExitOffer(): ClubeExitOfferState {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState<number>(() => Date.now());

  const { data } = useQuery<{ clube_intro_revealed_at: string | null; clube_exit_eligible_until: string | null } | null>({
    queryKey: ['clube-exit', user?.id],
    enabled: !!user?.id,
    staleTime: 15_000,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles' as any)
        .select('clube_intro_revealed_at, clube_exit_eligible_until')
        .eq('user_id', user.id)
        .maybeSingle();
      return data as { clube_intro_revealed_at: string | null; clube_exit_eligible_until: string | null } | null;
    },
  });

  const exitUntilMs = data?.clube_exit_eligible_until
    ? new Date(data.clube_exit_eligible_until).getTime()
    : 0;
  const remainingMs = exitUntilMs ? Math.max(0, exitUntilMs - now) : 0;
  const isActive = remainingMs > 0;
  const canStart = !!user?.id && !!data?.clube_intro_revealed_at;

  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isActive]);

  const start = useCallback(async () => {
    if (!user?.id || !canStart || isActive) return;
    const until = new Date(Date.now() + CLUBE_EXIT_WINDOW_MS).toISOString();
    await supabase
      .from('profiles' as any)
      .update({ clube_exit_eligible_until: until })
      .eq('user_id', user.id)
      .not('clube_intro_revealed_at', 'is', null);
    queryClient.invalidateQueries({ queryKey: ['clube-exit', user.id] });
  }, [canStart, isActive, queryClient, user?.id]);

  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

  return {
    isActive,
    canStart,
    remainingMs,
    mm,
    ss,
    price: CLUBE_EXIT_PRICE,
    discount: CLUBE_EXIT_DISCOUNT,
    start,
  };
}
