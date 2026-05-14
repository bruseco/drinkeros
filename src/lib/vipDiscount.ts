// Regra escalonada de desconto do Sócio do Clube:
// - Dias 0–7 após ativação: 80% OFF (intro)
// - Após 7 dias: 50% OFF permanente enquanto for Sócio
// - Vitalício / admin: 80% OFF permanente
// Mantenha esta lógica sincronizada com as edge functions:
// `create-product-checkout`, `create-mp-payment`, `create-mp-checkout`.

export const VIP_DISCOUNT_INTRO_PERCENT = 80;
export const VIP_DISCOUNT_BASE_PERCENT = 50;
export const VIP_INTRO_WINDOW_DAYS = 7;

/** @deprecated Use `useVipDiscount()` ou `getVipDiscountPercent()` */
export const VIP_DISCOUNT_PERCENT = VIP_DISCOUNT_INTRO_PERCENT;

export interface VipDiscountInput {
  activatedAt: string | Date | null | undefined;
  isLifetime: boolean;
  isVip: boolean;
}

export const getVipDiscountPercent = ({
  activatedAt,
  isLifetime,
  isVip,
}: VipDiscountInput): number => {
  if (isLifetime) return VIP_DISCOUNT_INTRO_PERCENT;
  if (!isVip) return 0;
  if (!activatedAt) return VIP_DISCOUNT_BASE_PERCENT;
  const activated = activatedAt instanceof Date ? activatedAt : new Date(activatedAt);
  const ms = Date.now() - activated.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
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
