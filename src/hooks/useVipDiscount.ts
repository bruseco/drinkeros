import { useMemo } from 'react';
import { useUserPlan } from './useUserPlan';
import {
  VIP_DISCOUNT_BASE_PERCENT,
  VIP_DISCOUNT_INTRO_PERCENT,
  VIP_INTRO_WINDOW_DAYS,
  getVipDiscountPercent,
} from '@/lib/vipDiscount';

export interface VipDiscountState {
  /** % de desconto efetivo agora (0 se não for sócio) */
  percent: number;
  /** Sócio comum dentro da janela de 7 dias */
  isIntroActive: boolean;
  /** Já passou da janela — desconto base */
  isBaseActive: boolean;
  /** Sócio (assinatura) ou Vitalício */
  isVip: boolean;
  /** Vitalício / admin — 80% permanente */
  isLifetime: boolean;
  /** Quando termina a janela de 80% (null se já terminou ou se for vitalício/não-sócio) */
  introExpiresAt: Date | null;
  /** Dias inteiros restantes (arredondados pra cima, 0..7) */
  daysRemaining: number;
  /** Horas inteiras restantes (arredondadas pra cima) */
  hoursRemaining: number;
  /** Pronto (não está carregando o plano) */
  ready: boolean;
}

const NEUTRAL: VipDiscountState = {
  percent: 0,
  isIntroActive: false,
  isBaseActive: false,
  isVip: false,
  isLifetime: false,
  introExpiresAt: null,
  daysRemaining: 0,
  hoursRemaining: 0,
  ready: false,
};

export const useVipDiscount = (): VipDiscountState => {
  const { data, isLoading } = useUserPlan();

  return useMemo<VipDiscountState>(() => {
    if (!data) return NEUTRAL;

    const { isVip, isLifetime, discount_intro_started_at } = data;
    const percent = getVipDiscountPercent({
      introStartedAt: discount_intro_started_at,
      isVip,
    });

    if (!isVip) {
      return { ...NEUTRAL, ready: !isLoading };
    }

    const isIntroActive = percent === VIP_DISCOUNT_INTRO_PERCENT;
    const isBaseActive = percent === VIP_DISCOUNT_BASE_PERCENT;

    let introExpiresAt: Date | null = null;
    let daysRemaining = 0;
    let hoursRemaining = 0;

    if (discount_intro_started_at) {
      const expires = new Date(discount_intro_started_at);
      expires.setUTCDate(expires.getUTCDate() + VIP_INTRO_WINDOW_DAYS);
      introExpiresAt = expires;
      const msLeft = expires.getTime() - Date.now();
      if (msLeft > 0) {
        hoursRemaining = Math.ceil(msLeft / (1000 * 60 * 60));
        daysRemaining = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      }
    }

    return {
      percent,
      isIntroActive,
      isBaseActive,
      isVip: true,
      isLifetime,
      introExpiresAt: isIntroActive ? introExpiresAt : null,
      daysRemaining,
      hoursRemaining,
      ready: !isLoading,
    };
  }, [data, isLoading]);
};
