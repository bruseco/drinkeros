import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Throttle por sessão para evitar centenas de ux_interactions duplicadas por usuário/dia.
function shouldLogUx(key: string, ttlMs: number): boolean {
  try {
    const raw = sessionStorage.getItem(key);
    const last = raw ? Number(raw) : 0;
    if (Number.isFinite(last) && Date.now() - last < ttlMs) return false;
    sessionStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}
const UX_TTL_MS = 30 * 60 * 1000; // 30min

export const useUxTracking = (upsellPosition: number, totalCarousels: number) => {
  const { user } = useAuth();
  const maxScrollRef = useRef(0);
  const scrollLoggedRef = useRef(false);
  const upsellViewLoggedRef = useRef(false);

  // Track scroll depth
  useEffect(() => {
    if (!user?.id) return;

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const pct = Math.round((window.scrollY / scrollHeight) * 100);
      if (pct > maxScrollRef.current) {
        maxScrollRef.current = pct;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Log scroll depth on page leave
    const logScrollDepth = () => {
      if (scrollLoggedRef.current || maxScrollRef.current === 0 || !user?.id) return;
      scrollLoggedRef.current = true;

      // Use sendBeacon for reliability on page unload
      const payload = JSON.stringify({
        user_id: user.id,
        event_type: 'scroll_depth',
        metadata: { scroll_pct: maxScrollRef.current, upsell_position: upsellPosition, total_carousels: totalCarousels },
      });

      // Best-effort insert
      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/ux_interactions`,
        new Blob([payload], { type: 'application/json' })
      );
    };

    window.addEventListener('beforeunload', logScrollDepth);
    window.addEventListener('pagehide', logScrollDepth);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', logScrollDepth);
      window.removeEventListener('pagehide', logScrollDepth);
      // Also log when component unmounts (SPA navigation)
      if (!scrollLoggedRef.current && maxScrollRef.current > 0 && user?.id) {
        supabase.from('ux_interactions').insert({
          user_id: user.id,
          event_type: 'scroll_depth',
          metadata: { scroll_pct: maxScrollRef.current, upsell_position: upsellPosition, total_carousels: totalCarousels },
        }).then(() => {});
      }
    };
  }, [user?.id, upsellPosition, totalCarousels]);

  // Create ref callback for IntersectionObserver on the upsell section
  const upsellRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !user?.id || upsellViewLoggedRef.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && !upsellViewLoggedRef.current) {
            upsellViewLoggedRef.current = true;
            supabase.from('ux_interactions').insert({
              user_id: user.id,
              event_type: 'upsell_view',
              metadata: { position: upsellPosition, total_carousels: totalCarousels },
            }).then(() => {});
            observer.disconnect();
          }
        },
        { threshold: 0.5 }
      );

      observer.observe(node);
    },
    [user?.id, upsellPosition, totalCarousels]
  );

  // Track upsell click
  const trackUpsellClick = useCallback(
    (productId?: string) => {
      if (!user?.id) return;
      supabase.from('ux_interactions').insert({
        user_id: user.id,
        event_type: 'upsell_click',
        metadata: { position: upsellPosition, total_carousels: totalCarousels, clicked_product_id: productId },
      }).then(() => {});
    },
    [user?.id, upsellPosition, totalCarousels]
  );

  return { upsellRef, trackUpsellClick };
};
