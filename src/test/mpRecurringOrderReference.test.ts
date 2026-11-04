// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { paidMonthlyPeriod } from '../../supabase/functions/_shared/clubMonthly';

function fixture(guest: boolean, existing = false) {
  let vip: any = existing ? { id: 'vip-1', metadata: { source: 'mercadopago', mp_authorized_payment_id: 'invoice-1', preserved: 'yes' }, amount: 7 } : null;
  const purchases = new Map<string, any>();
  const amount = guest ? 7 : 87;
  const admin: any = {
    from: (table: string) => {
      let operation = 'select'; let value: any;
      const result = () => {
        if (table === 'club_guest_checkouts') return { data: { id: 'guest-1', email: 'buyer@example.com', amount, billing_months: 1 }, error: null };
        if (table === 'vip_payments') {
          if (operation === 'insert') vip = { ...value, id: 'vip-1' };
          if (operation === 'update') vip = { ...vip, ...value };
          return { data: vip, error: null };
        }
        if (table === 'purchases' && operation === 'upsert') purchases.set(value.transaction_id, value);
        return { data: null, error: null };
      };
      const q: any = { select: () => q, eq: () => q,
        insert: (v: any) => { operation = 'insert'; value = v; return q; },
        update: (v: any) => { operation = 'update'; value = v; return q; },
        upsert: (v: any) => { operation = 'upsert'; value = v; return q; },
        maybeSingle: async () => result(), then: (resolve: any) => resolve(result()) };
      return q;
    },
    rpc: vi.fn().mockResolvedValue({ error: null }),
    functions: { invoke: vi.fn().mockResolvedValue({}) },
  };
  const gateway = vi.fn(async (input: any, _init?: RequestInit) => {
    const url = String(input);
    const data = url.includes('/authorized_payments/')
      ? { status: 'approved', preapproval_id: 'subscription-1', transaction_amount: amount, payment: { id: 'payment-1', status: 'approved' } }
      : url.includes('/preapproval/')
        ? { payer_email: 'buyer@example.com', external_reference: guest ? 'club-guest:guest-1:clube' : 'club:user-1', auto_recurring: { frequency: guest ? 1 : 12, frequency_type: 'months', transaction_amount: amount } }
        : { status: 'approved', transaction_amount: 7, currency_id: 'BRL', date_approved: '2026-11-04T00:53:01Z' };
    return new Response(JSON.stringify(data), { status: 200 });
  });
  let handler: (req: Request) => Promise<Response>;
  const source = readFileSync('supabase/functions/mercadopago-webhook/index.ts', 'utf8')
    .replace(/^import[\s\S]*?from ["'][^"']+["'];\s*/gm, '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const capi = vi.fn();
  runInNewContext(js, {
    serve: (fn: typeof handler) => { handler = fn; },
    Deno: { env: { get: () => 'isolated-test' } }, createClient: () => admin,
    paidMonthlyPeriod, fetch: gateway, URL, Response,
    resolveBuyerUser: vi.fn().mockResolvedValue({ userId: 'user-1', wasCreated: false }),
    logPurchaseResolutionFailure: vi.fn(), fireCapiPurchaseFromWebhook: capi, sendPurchaseEmails: vi.fn(),
    console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { purchases, vip: () => vip, gateway, capi,
    request: () => handler(new Request('https://example.com/mp', {
      method: 'POST', headers: { 'x-internal-mp-sync': 'isolated-test' },
      body: JSON.stringify({ type: 'authorized_payment', data: { id: 'invoice-1' } }),
    })) };
}

it.each([true, false])('shares the exact existing purchase key with the report (guest=%s) and preserves replay behavior', async guest => {
  const s = fixture(guest);
  expect((await s.request()).status).toBe(200);
  const expected = guest ? 'payment-1' : 'invoice-1';
  expect(s.vip().metadata.purchase_transaction_id).toBe(expected);
  expect(s.purchases.get(expected)?.amount_paid).toBe(guest ? 7 : 87);
  expect((await s.request()).status).toBe(200);
  expect(s.purchases.size).toBe(1);
  expect(s.vip().metadata.mp_authorized_payment_id).toBe('invoice-1');
  expect(s.capi.mock.calls.every(([, args]) => args.transactionId === expected)).toBe(true);
  expect(s.gateway.mock.calls.every(args => !args[1]?.method || args[1].method === 'GET')).toBe(true);
});

it('repairs a missing report reference on an existing VIP row while preserving its metadata and amount', async () => {
  const s = fixture(true, true);
  expect((await s.request()).status).toBe(200);
  expect(s.vip()).toMatchObject({ id: 'vip-1', amount: 7, metadata: { preserved: 'yes', purchase_transaction_id: 'payment-1' } });
});
