// @vitest-environment node
// Execute the actual edge handler with mocked boundary imports. No Stripe API,
// Supabase, email or CAPI request is made by this regression test.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { resolveStripeEventScope } from '../../supabase/functions/_shared/stripeEventScope';

function fixture(event: any, subscription: any = { metadata: {} }) {
  const writes: { table: string; value: any }[] = [];
  const from = vi.fn((table: string) => {
    const q: any = {
      select: () => q, eq: () => q, limit: () => q,
      upsert: (value: any) => { writes.push({ table, value }); return q; },
      insert: (value: any) => { writes.push({ table, value }); return q; },
      update: (value: any) => { writes.push({ table, value }); return q; },
      delete: () => { writes.push({ table, value: 'delete' }); return q; },
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: any) => resolve({ data: { id: 'row-1' }, error: null }),
    };
    return q;
  });
  const createClient = vi.fn(() => ({ from, functions: { invoke: vi.fn().mockResolvedValue({}) } }));
  const capi = vi.fn().mockResolvedValue(undefined);
  const retrieve = vi.fn().mockResolvedValue(subscription);
  const log = vi.fn();
  let handler: (req: Request) => Promise<Response>;
  const source = readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8')
    .replace(/^import[\s\S]*?from ["'][^"']+["'];\s*/gm, '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  runInNewContext(js, {
    serve: (fn: typeof handler) => { handler = fn; },
    Stripe: class {
      webhooks = { constructEventAsync: vi.fn(async (_body, sig) => {
        if (sig !== 'valid') throw new Error('Invalid signature');
        return event;
      }) };
      subscriptions = { retrieve };
    },
    Deno: { env: { get: () => 'test-placeholder' } },
    createClient, resolveStripeEventScope,
    fireCapiPurchaseFromWebhook: capi,
    resolveBuyerUser: vi.fn().mockResolvedValue({ userId: 'known-user', wasCreated: false }),
    logPurchaseResolutionFailure: vi.fn(), sendPurchaseEmails: vi.fn(), sendTemplateEmailWithLog: vi.fn(),
    Response, console: { log },
  });
  return {
    request: (signature = 'valid') => handler(new Request('https://example.com/webhook', {
      method: 'POST', headers: { 'stripe-signature': signature }, body: '{}',
    })), createClient, capi, retrieve, writes, log,
  };
}
const event = (type: string, object: any) => ({ id: 'evt-test', type, data: { object } });

describe('Stripe webhook isolation before all side effects', () => {
  it.each(['cs_live_a1Gc7ot0', 'cs_live_a1Zr4rTS', 'cs_live_a1abQRK6'])(
    'acknowledges foreign session %s with no database client, grants or Purchase', async id => {
      const s = fixture(event('checkout.session.completed', {
        id, metadata: { produto: 'nextbar', tipo: 'mensalidade_pix', user_id: 'foreign-user' },
        mode: 'payment', payment_status: 'paid', client_reference_id: null, amount_total: 29700,
      }));
      const response = await s.request();
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ignored: true, reason: 'foreign_app' });
      expect(s.createClient).not.toHaveBeenCalled();
      expect(s.capi).not.toHaveBeenCalled();
      expect(s.log.mock.calls.some(([line]) => line.includes('ignored_foreign_event'))).toBe(true);
    },
  );
  it.each(['invoice.paid', 'invoice.payment_failed', 'customer.subscription.deleted'])(
    'prevents foreign lifecycle event %s from altering access', async type => {
      const s = fixture(event(type, { id: 'foreign-object', subscription: 'sub-foreign', metadata: {} }));
      expect((await s.request()).status).toBe(200);
      expect(s.createClient).not.toHaveBeenCalled();
      expect(s.capi).not.toHaveBeenCalled();
    },
  );
  it('does not classify an owned but unknown payment as Club', async () => {
    const s = fixture(event('checkout.session.completed', { id: 'session', mode: 'payment', metadata: { app: 'drinkeros' } }));
    expect((await s.request()).status).toBe(200);
    expect(s.createClient).not.toHaveBeenCalled();
    expect(s.capi).not.toHaveBeenCalled();
  });
  it('logs an unmarked unsupported event as foreign without creating a database client', async () => {
    const s = fixture(event('payment_intent.succeeded', { id: 'pi-foreign', metadata: {} }));
    expect((await s.request()).status).toBe(200);
    expect(s.createClient).not.toHaveBeenCalled();
    expect(s.log.mock.calls.some(([line]) => line.includes('ignored_foreign_event'))).toBe(true);
  });
  it('still requires a valid Stripe signature, even for foreign events', async () => {
    const s = fixture(event('checkout.session.completed', { metadata: {} }));
    expect((await s.request('invalid')).status).toBe(400);
    expect(s.createClient).not.toHaveBeenCalled();
    expect(s.retrieve).not.toHaveBeenCalled();
  });
  it('retries an unavailable subscription lookup without any side effects', async () => {
    const s = fixture(event('invoice.paid', { subscription: 'sub-owned' }));
    s.retrieve.mockRejectedValue(new Error('Unavailable'));
    expect((await s.request()).status).toBe(500);
    expect(s.createClient).not.toHaveBeenCalled();
    expect(s.capi).not.toHaveBeenCalled();
  });
  it.each(['checkout.session.completed', 'checkout.session.async_payment_succeeded'])(
    'keeps the existing purchase/CAPI path for paid owned annual events: %s', async type => {
      const s = fixture(event(type, {
        id: 'session-owned', mode: 'payment', payment_status: 'paid', client_reference_id: 'known-user',
        payment_intent: 'pi-owned', amount_total: 8700, currency: 'brl',
        metadata: { app: 'drinkeros', plan_kind: 'club_pix_annual' },
      }));
      expect((await s.request()).status).toBe(200);
      expect(s.writes.find(w => w.table === 'purchases')?.value).toMatchObject({
        product_type: 'club', transaction_id: 'pi-owned', metadata: { app: 'drinkeros' },
      });
      expect(s.capi).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ gateway: 'stripe', transactionId: 'pi-owned' }));
      expect(s.writes.every(w => !('meta_capi_sent_at' in Object(w.value)))).toBe(true);
    },
  );
  it('does not grant or record a payment until an owned session is paid', async () => {
    const s = fixture(event('checkout.session.completed', {
      id: 'session-owned', mode: 'payment', payment_status: 'unpaid',
      metadata: { app: 'drinkeros', plan_kind: 'club_pix_annual' },
    }));
    expect((await s.request()).status).toBe(200);
    expect(s.writes).toHaveLength(0);
    expect(s.capi).not.toHaveBeenCalled();
  });
});
