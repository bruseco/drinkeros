// Only server-authored Stripe object metadata establishes ownership. Never infer
// the app from a customer, email, amount, client_reference_id or previous purchase.
type Metadata = Record<string, string | undefined>;
type StripeObject = {
  id?: string;
  metadata?: Metadata | null;
  mode?: string;
  subscription?: string | { id: string } | null;
  subscription_details?: { metadata?: Metadata | null } | null;
  parent?: { subscription_details?: { metadata?: Metadata | null; subscription?: string | { id: string } | null } | null } | null;
};
type Event = { type: string; data: { object: StripeObject } };
export type StripeScope =
  | { allowed: false; reason: 'foreign_app' | 'unknown_product' | 'unsupported_event' }
  | { allowed: true; kind: 'course' | 'ebook' | 'club_annual' | 'club_subscription'; subscriptionId: string | null };

export async function resolveStripeEventScope(
  event: Event,
  retrieveSubscription: (id: string) => Promise<{ metadata?: Metadata | null }>,
): Promise<StripeScope> {
  const object = event.data.object;
  let metadata = object.metadata || {};
  let subscriptionId: string | null = null;
  const checkout = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  const invoice = event.type === 'invoice.paid' || event.type === 'invoice.payment_failed';
  const subscription = event.type === 'customer.subscription.deleted';
  if (!checkout && !invoice && !subscription) {
    return { allowed: false, reason: metadata.app === 'drinkeros' ? 'unsupported_event' : 'foreign_app' };
  }

  if (invoice) {
    // Basil+ nests subscription details under parent; older events use the
    // top-level subscription/subscription_details fields. Do not trust customer metadata.
    const details = object.parent?.subscription_details || object.subscription_details;
    const linked = object.parent?.subscription_details?.subscription || object.subscription;
    subscriptionId = typeof linked === 'string' ? linked : linked?.id || null;
    if (!subscriptionId || (metadata.app && metadata.app !== 'drinkeros')) return { allowed: false, reason: 'foreign_app' };
    metadata = details?.metadata || {};
    if (!metadata.app) metadata = (await retrieveSubscription(subscriptionId)).metadata || {};
  }

  if (metadata.app !== 'drinkeros') return { allowed: false, reason: 'foreign_app' };
  if (checkout && object.mode === 'payment') {
    if ((metadata.product_type === 'course' || metadata.product_type === 'ebook') && metadata.product_id?.trim()) {
      return { allowed: true, kind: metadata.product_type, subscriptionId: null };
    }
    if (metadata.plan_kind === 'vip_annual_one_time' || metadata.plan_kind === 'club_pix_annual') {
      return { allowed: true, kind: 'club_annual', subscriptionId: null };
    }
  }
  if ((invoice || subscription || (checkout && object.mode === 'subscription')) && metadata.plan_kind === 'club_card_subscription') {
    return { allowed: true, kind: 'club_subscription', subscriptionId };
  }
  return { allowed: false, reason: 'unknown_product' };
}
