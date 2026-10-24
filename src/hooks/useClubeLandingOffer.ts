import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useClubeIntroOffer, type ClubeIntroOfferState } from './useClubeIntroOffer';

const VISITOR_REVEAL_KEY = 'drinkeros:clube-public-revealed:v1';
export function useClubeLandingOffer(): ClubeIntroOfferState {
  const { user, isLoading: authLoading } = useAuth();
  const offer = useClubeIntroOffer();
  const [visitorRevealed, setVisitorRevealed] = useState(() => {
    try { return sessionStorage.getItem(VISITOR_REVEAL_KEY) === '1'; } catch { return false; }
  });
  const syncedUser = useRef<string | null>(null);
  useEffect(() => {
    if (!user) { syncedUser.current = null; return; }
    if (visitorRevealed && offer.isActive && !offer.isLoading && !offer.hasRevealed && syncedUser.current !== user.id) {
      syncedUser.current = user.id;
      void offer.markRevealed().catch(() => { syncedUser.current = null; });
    }
  }, [user, visitorRevealed, offer.isActive, offer.isLoading, offer.hasRevealed, offer.markRevealed]);
  const markRevealed = useCallback(async () => {
    if (user) { await offer.markRevealed(); return; }
    setVisitorRevealed(true);
    try { sessionStorage.setItem(VISITOR_REVEAL_KEY, '1'); } catch { /* The current page still remembers the reveal. */ }
  }, [user, offer.markRevealed]);
  const isActive = !user || offer.isActive;
  return { ...offer, isActive,
    isLoading: authLoading || (!!user && offer.isLoading),
    hasRevealed: user ? offer.hasRevealed || (offer.isActive && visitorRevealed) : visitorRevealed,
    price: isActive ? offer.promoPrice : offer.fullPrice,
    eligibleUntilMs: user ? offer.eligibleUntilMs : 0,
    markRevealed };
}
