import type { FunnelEvent } from '@/lib/funnelTracking';

export interface FunnelStepDef {
  /** Identificador único da etapa dentro do funil. */
  key: string;
  /** Evento de navegador (quando a etapa é medida por sessão). */
  event?: FunnelEvent;
  /**
   * Quando definido, a etapa é medida por vendas aprovadas no banco,
   * filtrando pelo valor pago (faixa em reais).
   */
  sales?: { min?: number; max?: number };
  label: string;
  hint?: string;
}

export interface FunnelDef {
  key: string;
  /** page_key usado em page_funnel_events */
  pageKey: string;
  name: string;
  description: string;
  publicPath: string;
  steps: FunnelStepDef[];
  /** Produto vinculado, usado nas etapas medidas por vendas do banco. */
  productType?: 'course' | 'combo' | 'ebook' | 'package';
  productSlug?: string;
}

export const FUNNELS: FunnelDef[] = [
  {
    key: 'rand',
    pageKey: 'rand',
    name: 'Funil RAND',
    description: 'Caminho de venda do curso do Rand na página /rand',
    publicPath: '/rand',
    productType: 'combo',
    productSlug: 'rand',
    steps: [
      { key: 'pageview', event: 'pageview', label: 'Acessou a página /rand', hint: 'Visitantes únicos' },
      { key: 'offer_1', event: 'offer_1_revealed', label: 'Pegou o desconto (R$ 197)', hint: 'Abriu o presente' },
      { key: 'checkout_1', event: 'checkout_1_started', label: 'Clicou em comprar por R$ 197', hint: 'Foi para o checkout' },
      { key: 'offer_2', event: 'offer_2_revealed', label: 'Abriu o 2º desconto (R$ 97)', hint: 'Clicou no link do e-mail' },
      { key: 'checkout_2', event: 'checkout_2_started', label: 'Clicou em comprar por R$ 97', hint: 'Checkout com cupom' },
      { key: 'sales_297', sales: { min: 150 }, label: 'Comprou por R$ 197', hint: 'Pagamento aprovado (banco)' },
      { key: 'sales_197', sales: { max: 149.99 }, label: 'Comprou por R$ 97', hint: 'Pagamento aprovado (banco)' },
    ],
  },
];


export const getFunnel = (key: string): FunnelDef | undefined =>
  FUNNELS.find((f) => f.key === key);
