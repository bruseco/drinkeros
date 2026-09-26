import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { trackPageViewCapi } from '@/lib/metaCapiBridge';


declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    __META_PIXEL_LAST_PAGEVIEW_PATH__?: string;
    __META_PIXEL_LAST_PAGEVIEW_TIME__?: number;
    __META_PIXEL_INITIALIZED_ID__?: string;
    __META_PIXEL_READY__?: boolean;
  }
}

let injected = false;
const PAGEVIEW_LOCK_MS = 3000;

const firePageViewFromGlobalRoute = (pathname: string) => {
  if (typeof window === 'undefined' || !window.fbq) return false;

  const now = Date.now();
  const lastPath = window.__META_PIXEL_LAST_PAGEVIEW_PATH__;
  const lastTime = window.__META_PIXEL_LAST_PAGEVIEW_TIME__ ?? 0;

  if (lastPath === pathname && now - lastTime < PAGEVIEW_LOCK_MS) {
    console.warn('[MetaPixel] PageView blocked by dedupe', pathname, now);
    return false;
  }

  const eventId = `pv:${pathname}:${now}`;
  window.__META_PIXEL_LAST_PAGEVIEW_PATH__ = pathname;
  window.__META_PIXEL_LAST_PAGEVIEW_TIME__ = now;
  window.fbq('track', 'PageView', {}, { eventID: eventId });
  console.log('[MetaPixel] PageView fired', pathname, eventId);
  // Espelha no CAPI (mesmo event_id p/ deduplicação + aparece em "Eventos de teste")
  trackPageViewCapi(pathname, eventId);
  return true;
};

const injectPixel = (pixelId: string) => {
  if (typeof window === 'undefined') return false;

  if (window.__META_PIXEL_INITIALIZED_ID__ === pixelId && window.fbq) {
    injected = true;
    window.__META_PIXEL_READY__ = true;
    return true;
  }

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
  injected = true;
  window.__META_PIXEL_INITIALIZED_ID__ = pixelId;
  window.__META_PIXEL_READY__ = true;
  console.log('[FacebookPixel] fbq init called (autoConfig off)', pixelId);
  firePageViewFromGlobalRoute(window.location.pathname);
  return true;
};


export const FacebookPixel: React.FC = () => {
  const location = useLocation();
  const isSafeRandDemo = location.pathname === '/rand/obrigado'
    && new URLSearchParams(location.search).get('demo') === '1';
  const [pixelReady, setPixelReady] = useState(() =>
    typeof window !== 'undefined' ? Boolean(window.__META_PIXEL_READY__) : false
  );

  useEffect(() => {
    console.log('[FacebookPixel] component mounted');
    return () => console.log('[FacebookPixel] component unmounted');
  }, []);



  useEffect(() => {
    if (isSafeRandDemo) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_public_tracking_settings');

      if (cancelled) return;
      if (error) {
        console.warn('[FacebookPixel] Erro lendo tracking_settings', error);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.facebook_pixel_enabled && row.facebook_pixel_id) {
        setPixelReady(injectPixel(row.facebook_pixel_id));
      } else {
        console.log('[FacebookPixel] Desativado ou sem ID configurado.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSafeRandDemo]);

  useEffect(() => {
    if (isSafeRandDemo) return;
    if (!pixelReady || !injected || !window.fbq) return;
    firePageViewFromGlobalRoute(location.pathname);
  }, [isSafeRandDemo, location.pathname, pixelReady]);

  return null;
};
