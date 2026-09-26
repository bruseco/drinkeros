import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

import { activeEbookIds, toEbookAccess } from './useUserEbooks';

describe('acesso permanente a e-books', () => {
  it('considera ativo todo registro não estornado, sem olhar validade', () => {
    const rows = [
      { ebook_id: 'a', refunded_at: null },
      { ebook_id: 'b', refunded_at: null },
    ];
    expect(activeEbookIds(rows)).toEqual(['a', 'b']);
  });

  it('nega registros estornados', () => {
    const rows = [
      { ebook_id: 'a', refunded_at: null },
      { ebook_id: 'b', refunded_at: '2026-01-01T00:00:00Z' },
    ];
    expect(activeEbookIds(rows)).toEqual(['a']);
  });

  it('nunca marca e-book como expirado', () => {
    const access = toEbookAccess([
      { ebook_id: 'a', refunded_at: null },
      { ebook_id: 'x', refunded_at: '2026-01-01T00:00:00Z' },
    ]);
    expect(access).toEqual([
      { ebook_id: 'a', expires_at: null, is_expired: false, effective_expires_at: null },
    ]);
  });
});
