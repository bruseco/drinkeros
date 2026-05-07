import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
  }
}

let injected = false;
let lastTrackedPath: string | null = null;

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

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
  lastTrackedPath = initialPath;
  console.log('[FacebookPixel] init + PageView', pixelId, initialPath);
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
        injectPixel(data.facebook_pixel_id, location.pathname);
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
    if (lastTrackedPath === location.pathname) return; // evita duplicar o PageView do init
    lastTrackedPath = location.pathname;
    window.fbq('track', 'PageView');
    console.log('[FacebookPixel] PageView', location.pathname);
  }, [location.pathname]);

  return null;
};
