/**
 * Lista centralizada de rotas 100% públicas de venda.
 *
 * Estas rotas DEVEM carregar normalmente para qualquer visitante,
 * mesmo sem login. Não devem redirecionar para /login, /signup ou
 * qualquer tela de autenticação no carregamento da página.
 *
 * Botões de compra:
 *  - Mercado Pago (ebooks, cursos, produtos avulsos): funcionam sem login
 *  - Stripe (Clube/assinatura): atualmente exige cadastro rápido antes do
 *    Stripe (`/signup?redirect=/pv-clube`) porque a edge function
 *    `create-club-checkout` precisa do user.id/email para vincular a
 *    assinatura via webhook. Esse é o único gate de auth permitido nessas
 *    páginas, e acontece somente no clique do botão — nunca no load.
 *
 * Rotas internas pagas (ex.: /app/**, /admin/**) NÃO entram aqui.
 */
export const PUBLIC_SALES_ROUTES: string[] = [
  '/pv-clube',
  '/pv-clube-b',
  '/vip',
  '/drinkeros-xperience',
  '/mixologia-avancada',
  '/bar-p-eventos',
  '/drinkdelivery-engarrafados',
  '/bartender-a-bordo',
  '/ingredientes-artesanais',
  '/producao-de-ingredientes-artesanais',
  '/classicos-destilados',
  '/workshop-alem-dos-classicos',
  '/bebida-decifrada',
  '/rand',
  '/quiz',
  // Ebooks (rota dinâmica /ebook/:slug)
  '/ebook/o-velho-guia-do-bartender',
  '/ebook/drinks-tematicos',
  '/ebook/os-30-drinks-com-tequila-para-deixar-suas-noites-mais-calientes',
  '/ebook/os-30-drinks-com-rum-que-vao-te-levar-ao-caribe',
  '/ebook/30-drinks-elegantes-com-gin-para-impressionar-a-galera',
  '/ebook/30-drinks-com-vodka-para-agitar-com-a-a-galera',
  '/ebook/os-30-drinks-com-whisky-pra-vc-se-sentir-um-poderoso-chefao',
  '/ebook/os-30-drinks-com-cachaca-para-se-orgulhar-do-brasil',
];


/**
 * Prefixos de rotas públicas (qualquer slug abaixo é público).
 * /ebook/* e /checkout/* (MP) também aceitam visitantes anônimos.
 */
export const PUBLIC_ROUTE_PREFIXES: string[] = [
  '/ebook/',
  '/checkout/ebook/',
  '/checkout/course/',
  '/checkout/combo/',
  '/checkout/package/',
];

export function isPublicSalesRoute(pathname: string): boolean {
  if (PUBLIC_SALES_ROUTES.includes(pathname)) return true;
  return PUBLIC_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));
}
