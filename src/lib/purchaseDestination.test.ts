import { describe, expect, it } from 'vitest';
import { accountDestination, purchaseDestination } from './purchaseDestination';
describe('purchase destinations', () => {
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
