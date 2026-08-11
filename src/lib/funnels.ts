import type { FunnelEvent } from '@/lib/funnelTracking';

export interface FunnelStepDef {
  event: FunnelEvent;
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
}

export const FUNNELS: FunnelDef[] = [
  {
    key: 'rand',
    pageKey: 'rand',
    name: 'Funil RAND',
    description: 'Caminho de venda do curso do Rand na página /rand',
    publicPath: '/rand',
    steps: [
      { event: 'pageview', label: 'Acessou a página /rand', hint: 'Visitantes únicos' },
      { event: 'offer_1_revealed', label: 'Pegou o desconto', hint: 'Abriu o presente' },
      { event: 'checkout_1_started', label: 'Clicou em comprar', hint: 'Foi para o checkout' },
      { event: 'subscription_confirmed', label: 'Comprou', hint: 'Pagamento confirmado' },
    ],
  },
];

export const getFunnel = (key: string): FunnelDef | undefined =>
  FUNNELS.find((f) => f.key === key);
