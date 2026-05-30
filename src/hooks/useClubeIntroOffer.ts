import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Oferta INTRO do Clube dos Drinkeros (variante B).
 * Mantém apenas dados estáveis (não re-renderiza a cada segundo).
 * Para mostrar countdown vivo, use `useIntroCountdown()`.
 */
export const CLUBE_PRICE_INTRO = 97;
export const CLUBE_PRICE_FULL = 197;

export interface ClubeIntroOfferState {
  isActive: boolean;
  /** Timestamp ms em que a elegibilidade expira (0 se inelegível). */
  eligibleUntilMs: number;
  price: number;
  promoPrice: number;
  fullPrice: number;
  hasRevealed: boolean;
  markRevealed: () => Promise<void>;
  isLoading: boolean;
}

interface IntroRow {
  clube_intro_eligible_until: string | null;
  clube_intro_revealed_at: string | null;
}

export function useClubeIntroOffer(): ClubeIntroOfferState {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<IntroRow | null>({
    queryKey: ['clube-intro', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: ensured, error: ensureError } = await supabase.rpc('ensure_clube_intro_offer' as any);
      if (!ensureError && Array.isArray(ensured) && ensured[0]) {
        return ensured[0] as IntroRow;
      }
      const { data } = await supabase
        .from('profiles')
        .select('clube_intro_eligible_until, clube_intro_revealed_at')
        .eq('user_id', user.id)
        .maybeSingle();
      return (data as IntroRow | null) ?? null;
    },
  });

  const eligibleUntilMs = data?.clube_intro_eligible_until
    ? new Date(data.clube_intro_eligible_until).getTime()
    : 0;
  // isActive é "estável" — só muda quando expira de fato; suficiente para gating
  // de UI. O countdown vivo fica isolado em useIntroCountdown.
  const isActive = eligibleUntilMs > Date.now();
  const hasRevealed = !!data?.clube_intro_revealed_at;

  const markRevealed = async () => {
    if (!user?.id || hasRevealed) return;
    await supabase
      .from('profiles')
      .update({ clube_intro_revealed_at: new Date().toISOString() })
      .eq('user_id', user.id);
    queryClient.invalidateQueries({ queryKey: ['clube-intro', user.id] });
    queryClient.invalidateQueries({ queryKey: ['clube-exit', user.id] });
  };

  return {
    isActive,
    eligibleUntilMs,
    price: isActive ? CLUBE_PRICE_INTRO : CLUBE_PRICE_FULL,
    promoPrice: CLUBE_PRICE_INTRO,
    fullPrice: CLUBE_PRICE_FULL,
    hasRevealed,
    markRevealed,
    isLoading,
  };
}

/**
 * Countdown vivo (mm:ss) isolado em componentes pequenos para não
 * re-renderizar a página inteira a cada segundo.
 */
export function useIntroCountdown(eligibleUntilMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!eligibleUntilMs || eligibleUntilMs <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [eligibleUntilMs]);
  const remainingMs = eligibleUntilMs ? Math.max(0, eligibleUntilMs - now) : 0;
  const totalSec = Math.ceil(remainingMs / 1000);
  return {
    remainingMs,
    mm: String(Math.floor(totalSec / 60)).padStart(2, '0'),
    ss: String(totalSec % 60).padStart(2, '0'),
    isActive: remainingMs > 0,
  };
}
