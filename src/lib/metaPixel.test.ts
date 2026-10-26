import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trackInitiateCheckout } from './metaPixel';

describe('InitiateCheckout', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('landing + checkout do Clube disparam um único InitiateCheckout, com eventID', () => {
    const fbq = vi.fn();
    (window as any).fbq = fbq;
    trackInitiateCheckout({ amount: 87, product_name: 'Clube dos Drinkeros · Anual', product_type: 'subscription', dedupe_key: 'clube-anual' });
    trackInitiateCheckout({ amount: 87, product_name: 'Clube', product_type: 'subscription', product_id: 'abc', id: 123, dedupe_key: 'clube-anual' });
    const ic = fbq.mock.calls.filter((c) => c[1] === 'InitiateCheckout');
    expect(ic).toHaveLength(1);
    expect(ic[0][3].eventID).toMatch(/^ic:clube-anual:/);
  });
});
