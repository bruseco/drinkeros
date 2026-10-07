// Money is stored in cents. Shared by the server and financial regression tests.
export interface RandPayment {
  payment_id: string;
  paid_at: string;
  method: 'pix' | 'card';
  gross_cents: number;
  refund_cents: number;
  fee_cents: number;
  status: string;
}

export interface RecognizedPayment {
  payment_id: string;
  month: string;
  net_cents: number;
  refund_cents: number;
  tax_cents: number;
}

export interface ClosingLine extends RandPayment {
  tax_cents: number;
  net_cents: number;
  delta_cents: number;
  original_month: string;
  adjustment: boolean;
  carried: boolean;
}

export interface RandReport {
  month: string;
  sales_count: number;
  refund_count: number;
  gross_cents: number;
  refund_cents: number;
  tax_base_cents: number;
  pix_fee_cents: number;
  card_fee_cents: number;
  tax_cents: number;
  adjustments_cents: number;
  net_cents: number;
  rand_cents: number;
  drinkeros_cents: number;
  lines: ClosingLine[];
  carry_months: string[];
}

export function brMonth(date: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date(date));
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
}

export function cents(value: unknown): number {
  const amount = Number(value);
  if (value == null || value === '' || !Number.isFinite(amount) || amount < 0) {
    throw new Error('Valor financeiro ausente ou inválido no Mercado Pago.');
  }
  return Math.round(amount * 100);
}

// Only seller-paid fees are deducted. An explicit empty list means zero fees;
// an absent list is incomplete information and must never silently become zero.
export function normalizeMpPayment(p: Record<string, any>): RandPayment | null {
  if (p.live_mode !== true) throw new Error('Pagamento de teste não pode entrar no fechamento.');
  if (p.currency_id !== 'BRL') throw new Error('Pagamento em moeda diferente de BRL.');
  if (!p.date_approved) {
    if (['pending', 'in_process', 'rejected', 'cancelled'].includes(p.status)) return null;
    throw new Error('Data de aprovação ausente no Mercado Pago.');
  }
  if (!['approved', 'refunded', 'charged_back'].includes(p.status)) {
    throw new Error('Pagamento com contestação ou status pendente: confira antes de acertar.');
  }
  if (!Array.isArray(p.fee_details)) throw new Error('Taxas reais indisponíveis no Mercado Pago.');
  if (p.payment_method_id !== 'pix' && !['credit_card', 'debit_card'].includes(p.payment_type_id)) {
    throw new Error('Forma de pagamento não suportada no fechamento RAND.');
  }
  const gross = cents(p.transaction_amount);
  const refunds = p.transaction_amount_refunded == null
    ? (p.status === 'refunded' || p.status === 'charged_back' ? gross : 0)
    : cents(p.transaction_amount_refunded);
  const refund = p.status === 'charged_back' ? gross : refunds;
  if (refund > gross) throw new Error('Estorno maior que o valor da venda.');
  let fee = 0;
  for (const f of p.fee_details) {
    if (!['collector', 'payer'].includes(f.fee_payer)) throw new Error('Responsável pela taxa não identificado.');
    if (f.fee_payer === 'collector') {
      const stated = cents(f.amount);
      if (refund > 0 && stated > 0) {
        const charges = Array.isArray(p.charges_details) ? p.charges_details.filter(c =>
          c.accounts?.from === 'collector' && c.name === f.type) : [];
        if (!charges.length) throw new Error('Não foi possível confirmar as taxas devolvidas de uma venda estornada.');
        const original = charges.reduce((n, c) => n + cents(c.amounts?.original), 0);
        const returned = charges.reduce((n, c) => n + cents(c.amounts?.refunded), 0);
        if (returned > original || ![original, original - returned].includes(stated)) {
          throw new Error('As taxas e devoluções do Mercado Pago não conciliam.');
        }
        fee += original - returned;
      } else fee += stated;
    }
  }
  if (fee > gross) throw new Error('Taxa maior que o valor da venda.');
  // Returned fees come from charges_details.amounts.refunded, never an estimate.
  return {
    payment_id: String(p.id), paid_at: String(p.date_approved),
    method: p.payment_method_id === 'pix' ? 'pix' : 'card',
    gross_cents: gross, refund_cents: refund, fee_cents: fee, status: p.status,
  };
}

export function calculateRandClosing(month: string, payments: RandPayment[], balances: RecognizedPayment[], carryMonths: string[] = []): RandReport {
  const prior = new Map(balances.map(b => [b.payment_id, b]));
  const seen = new Set<string>();
  const lines: ClosingLine[] = [];
  for (const p of payments) {
    if (seen.has(p.payment_id)) throw new Error('Pagamento duplicado no fechamento.');
    seen.add(p.payment_id);
    const saleMonth = brMonth(p.paid_at);
    const b = prior.get(p.payment_id);
    const carried = !b && carryMonths.includes(saleMonth) && saleMonth < month;
    if (saleMonth !== month && !b && !carried) continue;
    if (saleMonth > month) continue;
    const tax = b
      ? Math.max(0, b.tax_cents - Math.round((p.refund_cents - b.refund_cents) * 7 / 100))
      : Math.round((p.gross_cents - p.refund_cents) * 7 / 100);
    const net = p.gross_cents - p.refund_cents - p.fee_cents - tax;
    const delta = net - (b?.net_cents ?? 0);
    const adjustment = (!!b || carried) && saleMonth !== month;
    if (adjustment && delta === 0) continue;
    lines.push({ ...p, tax_cents: tax, net_cents: net, delta_cents: delta,
      original_month: b?.month ?? saleMonth, adjustment, carried });
  }
  // Negative pending months are carried by their constituent payments, never
  // by summing earlier statement totals (which could contain the same refund).
  for (const carriedMonth of carryMonths) {
    const group = lines.filter(l => l.carried && l.original_month === carriedMonth);
    const tax = Math.round(group.reduce((n, l) => n + l.gross_cents - l.refund_cents, 0) * 7 / 100);
    const difference = tax - group.reduce((n, l) => n + l.tax_cents, 0);
    if (group.length && difference) {
      const line = group.find(l => l.gross_cents > l.refund_cents) ?? group[0];
      line.tax_cents += difference; line.net_cents -= difference; line.delta_cents -= difference;
    }
  }
  const current = lines.filter(l => !l.adjustment);
  const sum = (key: keyof ClosingLine, rows = current) => rows.reduce((n, l) => n + Number(l[key]), 0);
  const gross = sum('gross_cents');
  const refund = sum('refund_cents');
  // Round the tax on the month's total, then allocate the rounding difference
  // to one line so persisted per-payment balances reconcile with the statement.
  const tax = Math.round((gross - refund) * 7 / 100);
  const rounding = tax - sum('tax_cents');
  if (current.length && rounding) {
    const line = current.find(l => l.gross_cents > l.refund_cents) ?? current[0];
    line.tax_cents += rounding;
    line.net_cents -= rounding;
    line.delta_cents -= rounding;
  }
  const adjustments = sum('delta_cents', lines.filter(l => l.adjustment));
  const net = sum('delta_cents');
  const total = net + adjustments;
  const rand = Math.round(total * 60 / 100);
  return {
    month, sales_count: current.filter(l => l.gross_cents > l.refund_cents).length,
    refund_count: current.filter(l => l.refund_cents > 0).length,
    gross_cents: gross, refund_cents: refund, tax_base_cents: gross - refund,
    pix_fee_cents: sum('fee_cents', current.filter(l => l.method === 'pix')),
    card_fee_cents: sum('fee_cents', current.filter(l => l.method === 'card')),
    tax_cents: tax, adjustments_cents: adjustments, net_cents: total,
    rand_cents: rand, drinkeros_cents: total - rand, lines, carry_months: carryMonths,
  };
}
