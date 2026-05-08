import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    __META_PIXEL_LAST_PAGEVIEW_PATH__?: string;
    __META_PIXEL_LAST_PAGEVIEW_TS__?: number;
    __META_PIXEL_PAGEVIEW_TS_BY_PATH__?: Record<string, number>;
  }
}

let injected = false;
const PAGEVIEW_DEDUPE_MS = 2000;

const trackPageViewOnce = (pathname: string) => {
  if (typeof window === 'undefined' || !window.fbq) return;

  const now = Date.now();
  const lastPath = window.__META_PIXEL_LAST_PAGEVIEW_PATH__;
  const lastTs = window.__META_PIXEL_LAST_PAGEVIEW_TS__ ?? 0;
  const pathTimestamps = window.__META_PIXEL_PAGEVIEW_TS_BY_PATH__ ?? {};
  const lastTsForPath = pathTimestamps[pathname] ?? 0;

  if (lastPath === pathname) {
    console.log('[MetaPixel] PageView skipped duplicate', pathname);
    return;
  }

  if (now - lastTsForPath < PAGEVIEW_DEDUPE_MS) {
    console.log('[MetaPixel] PageView skipped duplicate', pathname);
    return;
  }

  pathTimestamps[pathname] = now;
  window.__META_PIXEL_PAGEVIEW_TS_BY_PATH__ = pathTimestamps;
  window.__META_PIXEL_LAST_PAGEVIEW_PATH__ = pathname;
  window.__META_PIXEL_LAST_PAGEVIEW_TS__ = now;
  window.fbq('track', 'PageView');
  console.log('[MetaPixel] PageView fired', pathname);
};

const injectPixel = (pixelId: string, initialPath: string) => {
  if (injected || typeof window === 'undefined') return;
  injected = true;

  /* eslint-disable */
  (function (f: any, b, e, v, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    t.onload = () => console.log('[FacebookPixel] fbevents.js loaded');
    t.onerror = () =>
      console.warn(
        '[FacebookPixel] Falha ao carregar fbevents.js — provável bloqueador de anúncios.'
      );
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  // Desliga a detecção automática de eventos (SubscribedButtonClick, ButtonClick, etc.)
  // para que apenas eventos disparados manualmente apareçam no Pixel Helper.
  window.fbq('set', 'autoConfig', 'false', pixelId);
  window.fbq('init', pixelId);
  trackPageViewOnce(initialPath);
  console.log('[FacebookPixel] init (autoConfig off)', pixelId, initialPath);
};

export const FacebookPixel: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('tracking_settings')
        .select('facebook_pixel_id, facebook_pixel_enabled')
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.warn('[FacebookPixel] Erro lendo tracking_settings', error);
        return;
      }
      if (data?.facebook_pixel_enabled && data.facebook_pixel_id) {
        injectPixel(data.facebook_pixel_id, window.location.pathname);
      } else {
        console.log('[FacebookPixel] Desativado ou sem ID configurado.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!injected || !window.fbq) return;
    trackPageViewOnce(location.pathname);
  }, [location.pathname]);

  return null;
};
