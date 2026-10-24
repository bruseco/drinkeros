import { describe, expect, it } from 'vitest';
import { accountDestination, purchaseDestination } from './purchaseDestination';
describe('purchase destinations', () => {
  it('keeps Club signup and login in their intended funnel without arbitrary redirects', () => {
    expect(accountDestination('/pv-clube')).toBe('/pv-clube-b');
    expect(accountDestination('/pv-clube-b')).toBe('/pv-clube-b');
    expect(accountDestination('/clube-receitas')).toBe('/clube-receitas');
    expect(accountDestination('/checkout/club/clube-anual')).toBe('/checkout/club/clube-anual');
  });
  it('takes ebooks and courses to their respective member sections', () => {
    expect(purchaseDestination('ebook')).toBe('/app/ebooks');
    expect(purchaseDestination('course')).toBe('/app/cursos');
    expect(purchaseDestination('combo')).toBeNull();
    expect(purchaseDestination('club')).toBeNull();
  });
  it('preserves the section through account activation and login', () => {
    expect(accountDestination('/app/ebooks')).toBe('/app/ebooks');
    expect(accountDestination('/app/cursos')).toBe('/app/cursos');
  });
  it('rejects external or administrative redirect targets', () => {
    for (const target of [null, 'https://example.com', '//example.com', '/admin', '/app/../admin']) {
      expect(accountDestination(target)).toBe('/app');
    }
  });
});
