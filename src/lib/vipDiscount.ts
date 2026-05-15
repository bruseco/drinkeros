// Regra escalonada de desconto do Sócio do Clube (vale também para Vitalício):
// - Janela inicia em `discount_intro_started_at` (preenchido no primeiro login pós-deploy
//   via RPC `start_vip_discount_window`).
// - Dias 0–7 desde essa marca: 80% OFF (intro)
// - Após 7 dias: 50% OFF permanente
// - Se ainda não foi marcado (NULL): mostra 80% (estado de boas-vindas).
// Mantenha esta lógica sincronizada com as edge functions:
// `create-product-checkout`, `create-mp-payment`, `create-mp-checkout`.

export const VIP_DISCOUNT_INTRO_PERCENT = 80;
export const VIP_DISCOUNT_BASE_PERCENT = 50;
export const VIP_INTRO_WINDOW_DAYS = 7;

/** @deprecated Use `useVipDiscount()` ou `getVipDiscountPercent()` */
export const VIP_DISCOUNT_PERCENT = VIP_DISCOUNT_INTRO_PERCENT;

export interface VipDiscountInput {
  /** Marca de início da janela de 7 dias (user_plans.discount_intro_started_at) */
  introStartedAt: string | Date | null | undefined;
  isVip: boolean;
}

export const getVipDiscountPercent = ({
  introStartedAt,
  isVip,
}: VipDiscountInput): number => {
  if (!isVip) return 0;
  if (!introStartedAt) return VIP_DISCOUNT_INTRO_PERCENT;
  const started = introStartedAt instanceof Date ? introStartedAt : new Date(introStartedAt);
  const days = (Date.now() - started.getTime()) / (1000 * 60 * 60 * 24);
  return days <= VIP_INTRO_WINDOW_DAYS
    ? VIP_DISCOUNT_INTRO_PERCENT
    : VIP_DISCOUNT_BASE_PERCENT;
};

export const applyVipDiscountFor = (price: number, percent: number): number => {
  if (!price || price <= 0 || !percent) return price;
  return Number((price * (1 - percent / 100)).toFixed(2));
};

/** @deprecated Use `applyVipDiscountFor(price, percent)` com o percent vindo de `useVipDiscount()` */
export const applyVipDiscount = (price: number): number =>
  applyVipDiscountFor(price, VIP_DISCOUNT_INTRO_PERCENT);

export const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

/**
 * Texto curto de expiração da janela de 80% OFF do Sócio do Clube.
 * Usa horas restantes (≤ 24h => "expira HOJE"), senão "expira em N dias".
 * Retorna string vazia se não houver janela ativa.
 */
export const formatVipIntroExpiry = (
  daysRemaining: number,
  hoursRemaining: number,
): string => {
  if (hoursRemaining <= 0) return '';
  if (hoursRemaining <= 24) return 'expira HOJE';
  return `expira em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}`;
};
