import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useClubeLandingOffer } from './useClubeLandingOffer';
const mocks = vi.hoisted(() => ({ user: null as { id: string } | null, loading: false, active: false, revealed: false, mark: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, isLoading: mocks.loading }) }));
vi.mock('./useClubeIntroOffer', () => ({ useClubeIntroOffer: () => ({ isActive: mocks.active, eligibleUntilMs: 0, price: 197, promoPrice: 97, fullPrice: 197, hasRevealed: mocks.revealed, isLoading: false, markRevealed: mocks.mark }) }));
beforeEach(() => { sessionStorage.clear(); mocks.user = null; mocks.loading = false; mocks.active = false; mocks.revealed = false; mocks.mark.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
it('lets anonymous visitors reveal the offer without accessing account data', async () => {
  const { result } = renderHook(useClubeLandingOffer);
  expect(result.current.isActive).toBe(true); expect(result.current.hasRevealed).toBe(false); expect(result.current.isLoading).toBe(false);
  await act(async () => result.current.markRevealed()); expect(result.current.hasRevealed).toBe(true); expect(mocks.mark).not.toHaveBeenCalled();
});
it('remembers a visitor reveal across a page remount', async () => {
  const first = renderHook(useClubeLandingOffer); await act(async () => first.result.current.markRevealed()); first.unmount();
  const next = renderHook(useClubeLandingOffer); expect(next.result.current.hasRevealed).toBe(true);
});
it('preserves and records a public reveal after login into an eligible account', async () => {
  const { result, rerender } = renderHook(useClubeLandingOffer); await act(async () => result.current.markRevealed());
  mocks.user = { id: 'account' }; mocks.active = true; rerender();
  expect(result.current.hasRevealed).toBe(true); await waitFor(() => expect(mocks.mark).toHaveBeenCalledTimes(1));
});
it('retains existing account eligibility and waits for authentication loading', () => {
  mocks.user = { id: 'expired-account' }; const { result, rerender } = renderHook(useClubeLandingOffer);
  expect(result.current.isActive).toBe(false); expect(result.current.price).toBe(197);
  mocks.user = null; mocks.loading = true; rerender(); expect(result.current.isLoading).toBe(true);
});
