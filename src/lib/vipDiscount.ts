// Regra universal de desconto VIP: assinantes VIP recebem 80% OFF em todos os
// cursos e ebooks. Mantenha esta constante sincronizada com a edge function
// `create-product-checkout`.
export const VIP_DISCOUNT_PERCENT = 80;

export const applyVipDiscount = (price: number): number => {
  if (!price || price <= 0) return price;
  return Number((price * (1 - VIP_DISCOUNT_PERCENT / 100)).toFixed(2));
};

export const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
