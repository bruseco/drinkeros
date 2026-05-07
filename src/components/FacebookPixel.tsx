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

const injectPixel = (pixelId: string) => {
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
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
};

export const FacebookPixel: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('tracking_settings')
        .select('facebook_pixel_id, facebook_pixel_enabled')
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data?.facebook_pixel_enabled && data.facebook_pixel_id) {
        injectPixel(data.facebook_pixel_id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (injected && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [location.pathname]);

  return null;
};
