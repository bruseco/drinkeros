import { describe, expect, it } from 'vitest';
import { brMonth, calculateRandClosing, normalizeMpPayment, type RandPayment, type RandReport }
  from '../../supabase/functions/_shared/randClosing';

const sale = (overrides: Partial<RandPayment> = {}): RandPayment => ({
  payment_id: '123', paid_at: '2026-09-15T12:00:00-03:00', method: 'pix',
  gross_cents: 10000, refund_cents: 0, fee_cents: 100, status: 'approved', ...overrides,
});
const recognize = (r: RandReport) => r.lines.map(l => ({
  payment_id: l.payment_id, month: l.original_month,
  net_cents: l.net_cents, refund_cents: l.refund_cents, tax_cents: l.tax_cents,
}));
const mp = (overrides: Record<string, unknown> = {}) => ({
  id: 123, live_mode: true, currency_id: 'BRL', date_approved: '2026-09-01T12:00:00-03:00',
  status: 'approved', transaction_amount: 100, transaction_amount_refunded: 0,
  fee_details: [{ amount: 1, fee_payer: 'collector', type: 'mercadopago_fee' }],
  charges_details: [{ name: 'mercadopago_fee', accounts: { from: 'collector' }, amounts: { original: 1, refunded: 0 } }],
  payment_method_id: 'pix', ...overrides,
});

describe('RAND monthly financial statements', () => {
  it('deducts actual fees, taxes revenue before fees, and splits 60/40 with exact cents', () => {
    const r = calculateRandClosing('2026-09', [sale(), sale({ payment_id: '456', method: 'card', gross_cents: 20000, fee_cents: 800 })], []);
    expect(r).toMatchObject({ gross_cents: 30000, pix_fee_cents: 100, card_fee_cents: 800,
      tax_cents: 2100, net_cents: 27000, rand_cents: 16200, drinkeros_cents: 10800 });
  });
  it('uses approval date in Brazil across UTC/month boundaries', () => {
    expect(brMonth('2026-10-01T02:59:59Z')).toBe('2026-09');
    expect(brMonth('2026-10-01T03:00:00Z')).toBe('2026-10');
    const r = calculateRandClosing('2026-09', [sale({ paid_at: '2026-10-01T02:59:59Z' }), sale({ payment_id: '456', paid_at: '2026-10-01T03:00:00Z' })], []);
    expect(r.lines.map(l => l.payment_id)).toEqual(['123']);
  });
  it('excludes full refunds from tax revenue, while retaining unreimbursed actual fees', () => {
    const r = calculateRandClosing('2026-09', [sale({ refund_cents: 10000, status: 'refunded' })], []);
    expect(r).toMatchObject({ sales_count: 0, refund_count: 1, gross_cents: 10000,
      refund_cents: 10000, tax_cents: 0, net_cents: -100 });
  });
  it('handles partial refunds without removing the entire sale', () => {
    expect(calculateRandClosing('2026-09', [sale({ refund_cents: 2500 })], []))
      .toMatchObject({ tax_base_cents: 7500, tax_cents: 525, net_cents: 6875 });
  });
  it('deducts a late refund from the next closing only once', () => {
    const original = calculateRandClosing('2026-09', [sale()], []);
    const refunded = sale({ refund_cents: 10000, fee_cents: 0, status: 'refunded' });
    const october = calculateRandClosing('2026-10', [refunded], recognize(original));
    expect(october).toMatchObject({ gross_cents: 0, adjustments_cents: -9200, rand_cents: -5520 });
    expect(october.lines[0]).toMatchObject({ original_month: '2026-09', adjustment: true });
    const november = calculateRandClosing('2026-11', [refunded], recognize(october));
    expect(november.adjustments_cents).toBe(0);
  });
  it('recognizes a second partial refund incrementally', () => {
    const september = calculateRandClosing('2026-09', [sale()], []);
    const october = calculateRandClosing('2026-10', [sale({ refund_cents: 2000 })], recognize(september));
    expect(october.adjustments_cents).toBe(-1860);
    const november = calculateRandClosing('2026-11', [sale({ refund_cents: 5000 })], recognize(october));
    expect(november.adjustments_cents).toBe(-2790);
  });
  it('does not import unpaid prior months or future payments as adjustments', () => {
    const r = calculateRandClosing('2026-09', [sale({ paid_at: '2026-08-15T12:00:00-03:00' }), sale({ payment_id: '456', paid_at: '2026-10-15T12:00:00-03:00' })], []);
    expect(r.lines).toEqual([]);
    expect(r.net_cents).toBe(0);
  });
  it('rounds monthly tax once and persists balanced cents without phantom future adjustments', () => {
    const payments = [sale({ gross_cents: 10, fee_cents: 0 }), sale({ payment_id: '456', gross_cents: 10, fee_cents: 0 })];
    const september = calculateRandClosing('2026-09', payments, []);
    expect(september.tax_cents).toBe(1);
    expect(september.lines.reduce((n, l) => n + l.tax_cents, 0)).toBe(1);
    expect(september.rand_cents + september.drinkeros_cents).toBe(september.net_cents);
    expect(calculateRandClosing('2026-10', payments, recognize(september)).lines).toEqual([]);
  });
  it('rejects duplicate payment IDs rather than counting combo grants twice', () => {
    expect(() => calculateRandClosing('2026-09', [sale(), sale()], [])).toThrow('duplicado');
  });
  it('deducts only seller fees and accepts explicit zero fees', () => {
    expect(normalizeMpPayment(mp({ fee_details: [{ amount: 1.23, fee_payer: 'collector' }, { amount: 5, fee_payer: 'payer' }] }))?.fee_cents).toBe(123);
    expect(normalizeMpPayment(mp({ fee_details: [] }))?.fee_cents).toBe(0);
  });
  it('rejects absent fees, test payments, non-BRL, and unsupported payment methods', () => {
    for (const data of [{ fee_details: undefined }, { live_mode: false }, { currency_id: 'USD' },
      { payment_method_id: 'bolbradesco', payment_type_id: 'ticket' }]) {
      expect(() => normalizeMpPayment(mp(data))).toThrow();
    }
  });
  it('does not count pending payments and blocks unresolved disputes', () => {
    expect(normalizeMpPayment(mp({ status: 'pending', date_approved: null }))).toBeNull();
    expect(() => normalizeMpPayment(mp({ status: 'in_mediation' }))).toThrow('contestação');
  });
  it('treats charged-back payments as fully reversed and never invents a fee reimbursement', () => {
    expect(normalizeMpPayment(mp({ status: 'charged_back' })))
      .toMatchObject({ refund_cents: 10000, fee_cents: 100 });
  });
  it('uses actual returned fees instead of subtracting the original fee after a refund', () => {
    const p = mp({ transaction_amount_refunded: 50,
      charges_details: [{ name: 'mercadopago_fee', accounts: { from: 'collector' }, amounts: { original: 1, refunded: .5 } }],
    });
    expect(normalizeMpPayment(p)?.fee_cents).toBe(50);
    expect(() => normalizeMpPayment({ ...p, charges_details: undefined })).toThrow('taxas devolvidas');
  });
  it('carries negative pending months by payment without duplicating prior refund adjustments', () => {
    const oldRefund = sale({ refund_cents: 10000, status: 'refunded' });
    const current = sale({ payment_id: '456', paid_at: '2026-10-15T12:00:00-03:00' });
    const r = calculateRandClosing('2026-10', [oldRefund, current], [], ['2026-09']);
    expect(r).toMatchObject({ adjustments_cents: -100, net_cents: 9100 });
    expect(r.lines.find(l => l.payment_id === '123')).toMatchObject({ carried: true, original_month: '2026-09' });
    expect(calculateRandClosing('2026-11', [oldRefund, current], recognize(r), []).net_cents).toBe(0);
  });
});
