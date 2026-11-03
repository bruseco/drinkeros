import { describe, expect, it, vi } from 'vitest';
import { resolveStripeEventScope } from '../../supabase/functions/_shared/stripeEventScope';

const subscriptionMetadata = { app: 'drinkeros', plan_kind: 'club_card_subscription' };
const event = (type: string, object: any) => ({ type, data: { object } });

describe('Stripe app and product ownership', () => {
  it.each(['cs_live_a1Gc7ot0', 'cs_live_a1Zr4rTS', 'cs_live_a1abQRK6'])(
    'rejects an unmarked foreign session %s despite a user/customer reference', async id => {
      const retrieve = vi.fn();
      expect(await resolveStripeEventScope(event('checkout.session.completed', {
        id, mode: 'payment', metadata: {}, customer: 'shared-customer', client_reference_id: 'foreign-user',
      }), retrieve)).toEqual({ allowed: false, reason: 'foreign_app' });
      expect(retrieve).not.toHaveBeenCalled();
    },
  );
  it.each(['course', 'ebook'])('accepts an explicitly marked %s', async product_type => {
    expect(await resolveStripeEventScope(event('checkout.session.completed', {
      mode: 'payment', metadata: { app: 'drinkeros', product_type, product_id: 'product-1' },
    }), vi.fn())).toMatchObject({ allowed: true, kind: product_type });
  });
  it.each(['vip_annual_one_time', 'club_pix_annual'])('recognizes annual plan %s', async plan_kind => {
    expect(await resolveStripeEventScope(event('checkout.session.completed', {
      mode: 'payment', metadata: { app: 'drinkeros', plan_kind },
    }), vi.fn())).toMatchObject({ allowed: true, kind: 'club_annual' });
  });
  it.each([{ app: 'drinkeros' }, { app: 'drinkeros', product_type: 'combo', product_id: 'x' },
    { app: 'drinkeros', product_type: 'course' }, { app: 'drinkeros', plan_kind: 'other' }])(
    'never falls back to club for an unknown product: %j', async metadata => {
      expect(await resolveStripeEventScope(event('checkout.session.completed', {
        mode: 'payment', metadata,
      }), vi.fn())).toEqual({ allowed: false, reason: 'unknown_product' });
    },
  );
  it('requires a named recurring plan even for owned subscription sessions', async () => {
    expect(await resolveStripeEventScope(event('checkout.session.completed', {
      mode: 'subscription', metadata: { app: 'drinkeros' },
    }), vi.fn())).toMatchObject({ allowed: false });
    expect(await resolveStripeEventScope(event('checkout.session.completed', {
      mode: 'subscription', metadata: subscriptionMetadata,
    }), vi.fn())).toMatchObject({ allowed: true, kind: 'club_subscription' });
  });
  it.each(['invoice.paid', 'invoice.payment_failed'])('checks the actual subscription for %s', async type => {
    const retrieve = vi.fn().mockResolvedValue({ metadata: { app: 'nextbar', plan_kind: 'club_card_subscription' } });
    expect(await resolveStripeEventScope(event(type, { subscription: 'sub-foreign' }), retrieve))
      .toEqual({ allowed: false, reason: 'foreign_app' });
    expect(retrieve).toHaveBeenCalledWith('sub-foreign');
    retrieve.mockResolvedValue({ metadata: subscriptionMetadata });
    expect(await resolveStripeEventScope(event(type, { subscription: 'sub-owned' }), retrieve))
      .toMatchObject({ allowed: true, subscriptionId: 'sub-owned' });
  });
  it.each(['parent', 'legacy'])('accepts subscription metadata snapshots in %s invoices', async shape => {
    const retrieve = vi.fn();
    const details = { metadata: subscriptionMetadata, subscription: 'sub-owned' };
    const object = shape === 'parent' ? { parent: { subscription_details: details } }
      : { subscription: 'sub-owned', subscription_details: details };
    expect(await resolveStripeEventScope(event('invoice.paid', object), retrieve))
      .toMatchObject({ allowed: true, subscriptionId: 'sub-owned' });
    expect(retrieve).not.toHaveBeenCalled();
  });
  it('does not override an explicit foreign snapshot using later metadata', async () => {
    const retrieve = vi.fn().mockResolvedValue({ metadata: subscriptionMetadata });
    expect(await resolveStripeEventScope(event('invoice.paid', {
      subscription: 'sub-foreign', subscription_details: { metadata: { app: 'nextbar' } },
    }), retrieve)).toMatchObject({ allowed: false });
    expect(retrieve).not.toHaveBeenCalled();
  });
  it('ignores invoices without a subscription even if invoice metadata is marked', async () => {
    expect(await resolveStripeEventScope(event('invoice.paid', { metadata: subscriptionMetadata }), vi.fn()))
      .toMatchObject({ allowed: false });
  });
  it('rejects unmarked legacy subscriptions instead of inferring ownership from a customer', async () => {
    expect(await resolveStripeEventScope(event('invoice.paid', { subscription: 'sub-legacy' }),
      vi.fn().mockResolvedValue({ metadata: {} }))).toMatchObject({ allowed: false, reason: 'foreign_app' });
  });
  it('checks cancellation ownership too', async () => {
    expect(await resolveStripeEventScope(event('customer.subscription.deleted', { metadata: {} }), vi.fn()))
      .toMatchObject({ allowed: false });
    expect(await resolveStripeEventScope(event('customer.subscription.deleted', { metadata: subscriptionMetadata }), vi.fn()))
      .toMatchObject({ allowed: true });
  });
});
