import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Oferta INTRO do Clube dos Drinkeros (variante B).
 *
 * Elegibilidade vinculada ao USUÁRIO (não ao browser):
 * - Na criação da conta, `profiles.clube_intro_eligible_until` recebe now() + 30min.
 * - Enquanto `eligible_until > now()`, o desconto de R$100 está ativo (R$97).
 * - Após expirar, o preço volta a R$197.
 * - Usuários antigos têm `eligible_until = NULL` → nunca ativos.
 * - Visitantes deslogados: inativo (vê R$197 como base).
 *
 * Também controla `clube_intro_revealed_at` para garantir que a animação de
 * reveal apareça uma única vez.
 */
export const CLUBE_PRICE_INTRO = 97;
export const CLUBE_PRICE_FULL = 197;

export interface ClubeIntroOfferState {
  isActive: boolean;
  remainingMs: number;
  mm: string;
  ss: string;
  price: number;
  promoPrice: number;
  fullPrice: number;
  /** Já viu a animação de reveal */
  hasRevealed: boolean;
  /** Marca no banco que a animação foi exibida */
  markRevealed: () => Promise<void>;
  /** Loading inicial */
  isLoading: boolean;
}

interface IntroRow {
  clube_intro_eligible_until: string | null;
  clube_intro_revealed_at: string | null;
}

export function useClubeIntroOffer(): ClubeIntroOfferState {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState<number>(() => Date.now());

  const { data, isLoading } = useQuery<IntroRow | null>({
    queryKey: ['clube-intro', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user?.id) return null;
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
  const remainingMs = eligibleUntilMs ? Math.max(0, eligibleUntilMs - now) : 0;
  const isActive = remainingMs > 0;
  const hasRevealed = !!data?.clube_intro_revealed_at;

  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isActive]);

  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

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
    remainingMs,
    mm,
    ss,
    price: isActive ? CLUBE_PRICE_INTRO : CLUBE_PRICE_FULL,
    promoPrice: CLUBE_PRICE_INTRO,
    fullPrice: CLUBE_PRICE_FULL,
    hasRevealed,
    markRevealed,
    isLoading,
  };
}
