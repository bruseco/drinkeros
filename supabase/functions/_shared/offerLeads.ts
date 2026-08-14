// Configuração das ofertas de lead das páginas de venda (presente + cupom por e-mail).
// page_key precisa bater com o funnelPageKey usado no frontend.

export interface OfferConfig {
  /** Chave da página/funil (ex.: 'rand'). */
  pageKey: string;
  /** Tipo/slug do produto no checkout. */
  productType: "course" | "ebook" | "combo" | "package";
  productSlug: string;
  /** Preço após o presente (1º desconto). */
  revealPrice: number;
  /** Preço do cupom enviado por e-mail (2º desconto). */
  couponPrice: number;
  /** Minutos após a captura do lead para disparar o e-mail. */
  followupMinutes: number;
  /** Validade do cupom (horas) após o envio do e-mail. */
  couponValidHours: number;
  /** Template do e-mail de segunda oferta. */
  emailTemplate: string;
  /** Página de destino do link do e-mail. */
  landingPath: string;
}

export const OFFERS: Record<string, OfferConfig> = {
  rand: {
    pageKey: "rand",
    productType: "combo",
    productSlug: "rand",
    revealPrice: 297,
    couponPrice: 197,
    followupMinutes: 20,
    couponValidHours: 48,
    emailTemplate: "rand-offer-197",
    landingPath: "/rand",
  },
};

export const SITE_URL = "https://drinkeros.com";

export function normalizeEmail(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 255;
}

export function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
